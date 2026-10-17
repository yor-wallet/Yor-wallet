// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
 * Tests Foundry de YORExperimentalUSDTControlled, sans dépendance (pas de forge-std), comme YORExperimentalUSDT.t.sol.
 * Un échec = un `require` qui revert ; forge affiche le message.
 * Les erreurs personnalisées sont attendues par leur signature (abi.encodeWithSignature) : le test ne dépend ainsi
 * d'aucune syntaxe d'accès aux sélecteurs.
 */
import "../../contracts/YORExperimentalUSDTControlled.sol";

interface VmC {
    function warp(uint256 newTimestamp) external;
    function prank(address msgSender) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external returns (address);
    function deal(address who, uint256 newBalance) external;
}

/// Jeton qui renvoie un bool (cas ERC-20 standard).
contract MockTokenBool {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "mock: balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
}

/// Jeton qui ne renvoie RIEN (cas des USDT historiques).
contract MockTokenNoReturn {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
    }

    function transfer(address to, uint256 v) external {
        require(balanceOf[msg.sender] >= v, "mock: balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
    }
}

/// Jeton qui répond `false` sans revert.
contract MockTokenFalse {
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

/// Propriétaire (contrat) qui se fait rappeler pendant rescueERC20 : seul le verrou anti-réentrance peut alors bloquer l'appel imbriqué.
contract ReentrantOwnerBot {
    YORExperimentalUSDTControlled public token;
    bool public nestedReverted;
    bytes public nestedRevertData;

    function init(YORExperimentalUSDTControlled t) external {
        token = t;
    }

    function rescue(address evil) external {
        token.rescueERC20(evil, address(0xBEEF), 1);
    }

    function onTransfer(address evil) external {
        (bool ok, bytes memory ret) =
            address(token).call(abi.encodeWithSignature("rescueERC20(address,address,uint256)", evil, address(0xBEEF), 1));
        nestedReverted = !ok;
        nestedRevertData = ret;
    }
}

/// Jeton hostile : pendant transfer, il fait rappeler le propriétaire, qui retente rescueERC20.
contract MockTokenReenter {
    ReentrantOwnerBot public bot;

    constructor(ReentrantOwnerBot b) {
        bot = b;
    }

    function transfer(address, uint256) external returns (bool) {
        bot.onTransfer(address(this));
        return true;
    }
}

/// Destinataire de monnaie native qui refuse le paiement.
contract RejectsNative {
    receive() external payable {
        revert("no native");
    }
}

contract YORExperimentalUSDTControlledTest {
    VmC internal constant vm = VmC(address(uint160(uint256(keccak256("hevm cheat code")))));

    YORExperimentalUSDTControlled internal token;

    address internal constant OWNER = address(0xA0);
    address internal constant A = address(0xA);
    address internal constant B = address(0xB);
    address internal constant C = address(0xC);
    uint256 internal constant U = 1e6;
    uint256 internal constant T0 = 1_700_000_000;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AddedBlackList(address indexed account);
    event DestroyedBlackFunds(address indexed account, uint256 amount);
    event Paused(address account);
    event NativeReceived(address indexed from, uint256 amount);

    function setUp() public {
        vm.warp(T0);
        token = new YORExperimentalUSDTControlled("YOR Experimental USDT", "YOR-USDT", OWNER);
    }

    // ------------------------------------------------------------------ aides
    function _eq(uint256 a, uint256 b, string memory m) internal pure {
        require(a == b, m);
    }

    function _seq(string memory a, string memory b, string memory m) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), m);
    }

    function _give(address to, uint256 amount) internal {
        vm.prank(OWNER);
        token.transfer(to, amount);
    }

    function _revert(bytes memory err) internal {
        vm.expectRevert(err);
    }

    function _sig0(string memory s) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(s);
    }

    function _sigA(string memory s, address a) internal pure returns (bytes memory) {
        return abi.encodeWithSignature(s, a);
    }

    function _ok(bool ok, string memory m) internal pure {
        require(ok, m);
    }

    // ------------------------------------------------------------------ métadonnées, constructeur
    function test_metadata() public view {
        _seq(token.name(), "YOR Experimental USDT", "name");
        _seq(token.symbol(), "YOR-USDT", "symbol");
        _eq(token.decimals(), 6, "decimals");
        _eq(token.INITIAL_SUPPLY(), 50_000_000 * U, "initial supply constant");
        _eq(token.MAX_SUPPLY(), 1_000_000_000 * U, "max supply constant");
        _eq(token.totalSupply(), 50_000_000 * U, "total supply");
        _eq(token.balanceOf(OWNER), 50_000_000 * U, "owner balance");
        require(token.owner() == OWNER, "owner");
        require(token.pendingOwner() == address(0), "no pending owner");
        require(!token.paused(), "not paused");
    }

    function test_constructorRejectsZeroOwner() public {
        _revert(_sig0("ZeroAddress()"));
        new YORExperimentalUSDTControlled("YOR Experimental USDT", "YOR-USDT", address(0));
    }

    function test_constructorRefusesToImpersonateOthers() public {
        // Le jeton doit garder la marque YOR : ni « TETHER », ni « USDT » seuls, ni nom vide, ni préfixe seul.
        string[] memory names = new string[](6);
        names[0] = "TETHER";
        names[1] = "Tether USD";
        names[2] = "YOR"; // préfixe incomplet
        names[3] = "YOR "; // préfixe seul
        names[4] = "yor test"; // casse différente
        names[5] = "";
        for (uint256 i = 0; i < names.length; i++) {
            _revert(_sig0("InvalidBrand()"));
            new YORExperimentalUSDTControlled(names[i], "YOR-USDT", OWNER);
        }
        string[] memory symbols = new string[](5);
        symbols[0] = "USDT";
        symbols[1] = "TETHER";
        symbols[2] = "YOR-"; // préfixe seul
        symbols[3] = "YOR";
        symbols[4] = "";
        for (uint256 j = 0; j < symbols.length; j++) {
            _revert(_sig0("InvalidBrand()"));
            new YORExperimentalUSDTControlled("YOR Experimental USDT", symbols[j], OWNER);
        }
    }

    function test_constructorLengthLimits() public {
        // 64 octets pour le nom, 16 pour le symbole : à la limite, accepté ; au-delà, refusé.
        string memory name64 = "YOR 123456789012345678901234567890123456789012345678901234567890"; // 4 + 60 = 64
        string memory name65 = "YOR 1234567890123456789012345678901234567890123456789012345678901"; // 65
        string memory sym16 = "YOR-123456789012"; // 16
        string memory sym17 = "YOR-1234567890123"; // 17
        new YORExperimentalUSDTControlled(name64, sym16, OWNER);
        _revert(_sig0("InvalidBrand()"));
        new YORExperimentalUSDTControlled(name65, "YOR-USDT", OWNER);
        _revert(_sig0("InvalidBrand()"));
        new YORExperimentalUSDTControlled("YOR Experimental USDT", sym17, OWNER);
    }

    function test_constructorEmitsInitialMint() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), OWNER, 50_000_000 * U);
        new YORExperimentalUSDTControlled("YOR Experimental USDT", "YOR-USDT", OWNER);
    }

    // ------------------------------------------------------------------ ERC-20
    function test_transfer() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(OWNER, A, 10 * U);
        _give(A, 10 * U);
        _eq(token.balanceOf(A), 10 * U, "A");
        _eq(token.balanceOf(OWNER), 50_000_000 * U - 10 * U, "owner");
        _eq(token.totalSupply(), 50_000_000 * U, "supply unchanged");
        // montant zéro : transfert normal (norme ERC-20)
        vm.prank(A);
        require(token.transfer(B, 0), "zero transfer");
    }

    function test_transferRules() public {
        _give(A, 5 * U);
        vm.prank(A);
        _revert(_sig0("InsufficientBalance()"));
        token.transfer(B, 5 * U + 1);
        vm.prank(A);
        _revert(_sig0("ZeroAddress()"));
        token.transfer(address(0), 1);
        vm.prank(A);
        _revert(_sig0("InvalidRecipient()"));
        token.transfer(address(token), 1); // jeton envoyé au contrat : refusé (il serait bloqué)
    }

    function test_approveAndTransferFrom() public {
        _give(A, 10 * U);
        vm.expectEmit(true, true, false, true);
        emit Approval(A, B, 4 * U);
        vm.prank(A);
        token.approve(B, 4 * U);
        _eq(token.allowance(A, B), 4 * U, "allowance");
        vm.prank(B);
        token.transferFrom(A, C, 3 * U);
        _eq(token.allowance(A, B), 1 * U, "allowance decreased");
        _eq(token.balanceOf(C), 3 * U, "C");
        vm.prank(B);
        _revert(_sig0("InsufficientAllowance()"));
        token.transferFrom(A, C, 2 * U);
    }

    function test_infiniteAllowanceIsNotDecreased() public {
        _give(A, 10 * U);
        vm.prank(A);
        token.approve(B, type(uint256).max);
        vm.prank(B);
        token.transferFrom(A, C, 6 * U);
        _eq(token.allowance(A, B), type(uint256).max, "still infinite");
    }

    function test_approveToZeroRefused() public {
        vm.prank(A);
        _revert(_sig0("ZeroAddress()"));
        token.approve(address(0), 1);
    }

    // ------------------------------------------------------------------ émission, plafond, burn
    function test_mintOnlyOwnerAndRules() public {
        vm.prank(A);
        _revert(abi.encodeWithSignature("NotOwner(address)", A));
        token.mint(A, 1);

        vm.prank(OWNER);
        _revert(_sig0("ZeroAddress()"));
        token.mint(address(0), 1);
        vm.prank(OWNER);
        _revert(_sig0("InvalidRecipient()"));
        token.mint(address(token), 1);
        vm.prank(OWNER);
        _revert(_sig0("ZeroAmount()"));
        token.mint(A, 0);

        vm.prank(OWNER);
        token.mint(A, 7 * U);
        _eq(token.balanceOf(A), 7 * U, "minted");
        _eq(token.totalSupply(), 50_000_000 * U + 7 * U, "supply grew");
    }

    function test_capIsEnforcedExactly() public {
        uint256 room = token.MAX_SUPPLY() - token.totalSupply();
        vm.prank(OWNER);
        token.mint(A, room); // pile au plafond : accepté
        _eq(token.totalSupply(), token.MAX_SUPPLY(), "at cap");
        vm.prank(OWNER);
        _revert(_sig0("CapExceeded()"));
        token.mint(A, 1);
        // après une destruction, la place est de nouveau disponible
        vm.prank(A);
        token.burn(10);
        vm.prank(OWNER);
        token.mint(B, 10);
        vm.prank(OWNER);
        _revert(_sig0("CapExceeded()"));
        token.mint(B, 1);
    }

    function test_burn() public {
        _give(A, 10 * U);
        vm.expectEmit(true, true, false, true);
        emit Transfer(A, address(0), 4 * U);
        vm.prank(A);
        token.burn(4 * U);
        _eq(token.balanceOf(A), 6 * U, "A after burn");
        _eq(token.totalSupply(), 50_000_000 * U - 4 * U, "supply after burn");
        vm.prank(A);
        _revert(_sig0("InsufficientBalance()"));
        token.burn(6 * U + 1);
    }

    function test_burnFrom() public {
        _give(A, 10 * U);
        vm.prank(B);
        _revert(_sig0("InsufficientAllowance()"));
        token.burnFrom(A, 1);
        vm.prank(A);
        token.approve(B, 5 * U);
        vm.prank(B);
        token.burnFrom(A, 3 * U);
        _eq(token.balanceOf(A), 7 * U, "A");
        _eq(token.allowance(A, B), 2 * U, "allowance");
        _eq(token.totalSupply(), 50_000_000 * U - 3 * U, "supply");
    }

    // ------------------------------------------------------------------ pause
    function test_pauseBlocksMovementsButNotApprove() public {
        _give(A, 10 * U);
        vm.prank(A);
        token.approve(B, 5 * U);

        vm.prank(A);
        _revert(abi.encodeWithSignature("NotOwner(address)", A));
        token.pause();

        vm.expectEmit(false, false, false, true);
        emit Paused(OWNER);
        vm.prank(OWNER);
        token.pause();
        require(token.paused(), "paused");

        vm.prank(A);
        _revert(_sig0("EnforcedPause()"));
        token.transfer(C, 1);
        vm.prank(B);
        _revert(_sig0("EnforcedPause()"));
        token.transferFrom(A, C, 1);
        vm.prank(OWNER);
        _revert(_sig0("EnforcedPause()"));
        token.mint(A, 1);
        vm.prank(A);
        _revert(_sig0("EnforcedPause()"));
        token.burn(1);
        vm.prank(OWNER);
        _revert(_sig0("EnforcedPause()"));
        token.pause(); // déjà en pause

        vm.prank(A);
        token.approve(C, 1); // approve reste possible

        vm.prank(OWNER);
        token.unpause();
        vm.prank(OWNER);
        _revert(_sig0("ExpectedPause()"));
        token.unpause();
        vm.prank(A);
        token.transfer(C, 1);
        _eq(token.balanceOf(C), 1, "works again");
    }

    // ------------------------------------------------------------------ liste noire
    function test_blacklistBlocksEverywhere() public {
        _give(A, 10 * U);
        _give(B, 10 * U);
        vm.prank(A);
        token.approve(C, 5 * U);

        vm.expectEmit(true, false, false, false);
        emit AddedBlackList(A);
        vm.prank(OWNER);
        token.addBlackList(A);
        require(token.isBlacklisted(A), "listed");

        vm.prank(A);
        _revert(_sigA("AccountBlacklisted(address)", A));
        token.transfer(B, 1);
        vm.prank(B);
        _revert(_sigA("AccountBlacklisted(address)", A));
        token.transfer(A, 1);
        vm.prank(C);
        _revert(_sigA("AccountBlacklisted(address)", A));
        token.transferFrom(A, B, 1); // allocation faite avant l'inscription : inutilisable
        vm.prank(A);
        _revert(_sigA("AccountBlacklisted(address)", A));
        token.approve(B, 1);
        vm.prank(B);
        _revert(_sigA("AccountBlacklisted(address)", A));
        token.approve(A, 1);
        vm.prank(OWNER);
        _revert(_sigA("AccountBlacklisted(address)", A));
        token.mint(A, 1);

        // un dépensier listé ne peut plus utiliser une allocation faite avant son inscription
        vm.prank(B);
        token.approve(C, 5 * U);
        vm.prank(OWNER);
        token.addBlackList(C);
        vm.prank(C);
        _revert(_sigA("AccountBlacklisted(address)", C));
        token.transferFrom(B, address(0xD), 1);
        vm.prank(C);
        _revert(_sigA("AccountBlacklisted(address)", C));
        token.burnFrom(B, 1);

        // retrait de la liste : tout refonctionne
        vm.prank(OWNER);
        token.removeBlackList(A);
        vm.prank(A);
        token.transfer(B, 1);
    }

    function test_blacklistRules() public {
        vm.prank(A);
        _revert(abi.encodeWithSignature("NotOwner(address)", A));
        token.addBlackList(B);
        vm.prank(OWNER);
        _revert(_sig0("ZeroAddress()"));
        token.addBlackList(address(0));
        vm.prank(OWNER);
        _revert(_sig0("CannotBlacklistOwner()"));
        token.addBlackList(OWNER);
        vm.prank(OWNER);
        token.addBlackList(B);
        vm.prank(OWNER);
        _revert(_sigA("AlreadyBlacklisted(address)", B));
        token.addBlackList(B);
        vm.prank(OWNER);
        _revert(_sigA("NotBlacklisted(address)", C));
        token.removeBlackList(C);
    }

    function test_destroyBlackFundsReallyWorks() public {
        _give(A, 10 * U);
        uint256 supplyBefore = token.totalSupply();

        vm.prank(OWNER);
        _revert(_sigA("NotBlacklisted(address)", A));
        token.destroyBlackFunds(A); // pas listé

        vm.prank(OWNER);
        token.addBlackList(A);

        vm.prank(A);
        _revert(abi.encodeWithSignature("NotOwner(address)", A));
        token.destroyBlackFunds(A);

        vm.expectEmit(true, true, false, true);
        emit Transfer(A, address(0), 10 * U);
        vm.expectEmit(true, false, false, true);
        emit DestroyedBlackFunds(A, 10 * U);
        vm.prank(OWNER);
        token.destroyBlackFunds(A);

        _eq(token.balanceOf(A), 0, "balance destroyed");
        _eq(token.totalSupply(), supplyBefore - 10 * U, "supply reduced");

        vm.prank(OWNER);
        _revert(_sig0("ZeroAmount()"));
        token.destroyBlackFunds(A); // plus rien à détruire
    }

    function test_destroyBlackFundsWorksWhilePaused() public {
        _give(A, 4 * U);
        vm.prank(OWNER);
        token.addBlackList(A);
        vm.prank(OWNER);
        token.pause();
        vm.prank(OWNER);
        token.destroyBlackFunds(A);
        _eq(token.balanceOf(A), 0, "destroyed during pause");
    }

    // ------------------------------------------------------------------ propriété
    function test_twoStepOwnership() public {
        vm.prank(A);
        _revert(abi.encodeWithSignature("NotOwner(address)", A));
        token.transferOwnership(A);

        vm.prank(OWNER);
        token.transferOwnership(A);
        require(token.owner() == OWNER, "still the old owner");
        require(token.pendingOwner() == A, "pending");

        vm.prank(B);
        _revert(abi.encodeWithSignature("NotPendingOwner(address)", B));
        token.acceptOwnership();

        vm.prank(A);
        token.acceptOwnership();
        require(token.owner() == A, "new owner");
        require(token.pendingOwner() == address(0), "pending cleared");

        vm.prank(OWNER);
        _revert(abi.encodeWithSignature("NotOwner(address)", OWNER));
        token.pause();
        vm.prank(A);
        token.pause();
    }

    function test_renounceIsDisabled() public {
        vm.prank(OWNER);
        _revert(_sig0("RenounceDisabled()"));
        token.renounceOwnership();
        vm.prank(A);
        _revert(_sig0("RenounceDisabled()"));
        token.renounceOwnership();
        require(token.owner() == OWNER, "owner kept");
    }

    function test_blacklistedCandidateCannotAcceptOwnership() public {
        vm.prank(OWNER);
        token.addBlackList(A);
        vm.prank(OWNER);
        token.transferOwnership(A);
        vm.prank(A);
        _revert(_sigA("AccountBlacklisted(address)", A));
        token.acceptOwnership();
    }

    // ------------------------------------------------------------------ permit (EIP-2612)
    uint256 internal constant PK = 0xA11CE; // clé de test, sans valeur

    function _digest(address holder, address spender, uint256 value, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes32)
    {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("YOR Experimental USDT")),
                keccak256(bytes("1")),
                block.chainid,
                address(token)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                holder,
                spender,
                value,
                nonce,
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function test_domainSeparatorMatchesEip712() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("YOR Experimental USDT")),
                keccak256(bytes("1")),
                block.chainid,
                address(token)
            )
        );
        require(token.DOMAIN_SEPARATOR() == expected, "domain separator");
        require(
            token.PERMIT_TYPEHASH()
                == keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
            "permit typehash"
        );
    }

    function test_permitSetsAllowanceAndBumpsNonce() public {
        address holder = vm.addr(PK);
        uint256 deadline = T0 + 1 hours;
        bytes32 d = _digest(holder, B, 9 * U, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PK, d);
        _eq(token.nonces(holder), 0, "nonce 0");
        vm.expectEmit(true, true, false, true);
        emit Approval(holder, B, 9 * U);
        token.permit(holder, B, 9 * U, deadline, v, r, s); // n'importe qui peut soumettre la signature
        _eq(token.allowance(holder, B), 9 * U, "allowance set");
        _eq(token.nonces(holder), 1, "nonce 1");
        // rejouer la même signature : refusé (le nonce a changé)
        _revert(_sig0("InvalidSignature()"));
        token.permit(holder, B, 9 * U, deadline, v, r, s);
    }

    function test_permitRejections() public {
        address holder = vm.addr(PK);
        uint256 deadline = T0 + 1 hours;
        bytes32 d = _digest(holder, B, 5 * U, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PK, d);

        // expiré
        vm.warp(deadline + 1);
        _revert(_sig0("PermitExpired()"));
        token.permit(holder, B, 5 * U, deadline, v, r, s);
        vm.warp(T0);

        // montant modifié, dépensier modifié, signataire différent
        _revert(_sig0("InvalidSignature()"));
        token.permit(holder, B, 5 * U + 1, deadline, v, r, s);
        _revert(_sig0("InvalidSignature()"));
        token.permit(holder, C, 5 * U, deadline, v, r, s);
        _revert(_sig0("InvalidSignature()"));
        token.permit(A, B, 5 * U, deadline, v, r, s);

        // v hors 27 / 28
        _revert(_sig0("InvalidSignature()"));
        token.permit(holder, B, 5 * U, deadline, v + 2, r, s);

        // s haut (signature malléable) : même signature « miroir » refusée
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 highS = bytes32(n - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;
        _revert(_sig0("InvalidSignature()"));
        token.permit(holder, B, 5 * U, deadline, flippedV, r, highS);

        // la bonne signature passe toujours
        token.permit(holder, B, 5 * U, deadline, v, r, s);
        _eq(token.allowance(holder, B), 5 * U, "valid permit");
    }

    function test_permitCannotBeUsedByOrForBlacklisted() public {
        address holder = vm.addr(PK);
        uint256 deadline = T0 + 1 hours;
        vm.prank(OWNER);
        token.addBlackList(holder);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PK, _digest(holder, B, 1, 0, deadline));
        _revert(_sigA("AccountBlacklisted(address)", holder));
        token.permit(holder, B, 1, deadline, v, r, s);
    }

    // ------------------------------------------------------------------ récupération
    function test_rescueERC20() public {
        MockTokenBool tb = new MockTokenBool();
        MockTokenNoReturn tn = new MockTokenNoReturn();
        tb.mint(address(token), 100);
        tn.mint(address(token), 100);

        vm.prank(A);
        _revert(abi.encodeWithSignature("NotOwner(address)", A));
        token.rescueERC20(address(tb), A, 10);

        vm.prank(OWNER);
        token.rescueERC20(address(tb), C, 40);
        _eq(tb.balanceOf(C), 40, "bool token rescued");
        vm.prank(OWNER);
        token.rescueERC20(address(tn), C, 60); // jeton sans valeur de retour : accepté
        _eq(tn.balanceOf(C), 60, "no-return token rescued");

        vm.prank(OWNER);
        _revert(_sig0("CannotRescueSelf()"));
        token.rescueERC20(address(token), C, 1);
        vm.prank(OWNER);
        _revert(_sig0("ZeroAddress()"));
        token.rescueERC20(address(tb), address(0), 1);
        vm.prank(OWNER);
        _revert(_sig0("RescueFailed()"));
        token.rescueERC20(address(0x1234), C, 1); // pas un contrat
        MockTokenFalse tf = new MockTokenFalse();
        vm.prank(OWNER);
        _revert(_sig0("RescueFailed()"));
        token.rescueERC20(address(tf), C, 1); // répond false
        vm.prank(OWNER);
        _revert(_sig0("RescueFailed()"));
        token.rescueERC20(address(tb), C, 1000); // le jeton revert (solde insuffisant)
    }

    function test_rescueERC20ReentrancyIsBlocked() public {
        ReentrantOwnerBot bot = new ReentrantOwnerBot();
        YORExperimentalUSDTControlled t2 =
            new YORExperimentalUSDTControlled("YOR Experimental USDT", "YOR-USDT", address(bot));
        bot.init(t2);
        MockTokenReenter evil = new MockTokenReenter(bot);
        bot.rescue(address(evil)); // l'appel extérieur réussit
        require(bot.nestedReverted(), "nested rescue must fail");
        require(
            keccak256(bot.nestedRevertData()) == keccak256(abi.encodeWithSignature("Reentrancy()")),
            "the lock (Reentrancy) is what stopped it"
        );
    }

    function test_nativeReceivedAndRescued() public {
        vm.deal(address(this), 5 ether);
        vm.expectEmit(true, false, false, true);
        emit NativeReceived(address(this), 3 ether);
        (bool ok,) = address(token).call{value: 3 ether}("");
        _ok(ok, "receive");
        _eq(address(token).balance, 3 ether, "contract balance");

        vm.prank(A);
        _revert(abi.encodeWithSignature("NotOwner(address)", A));
        token.rescueNative(A, 1);

        vm.prank(OWNER);
        _revert(_sig0("InsufficientBalance()"));
        token.rescueNative(A, 4 ether);
        vm.prank(OWNER);
        _revert(_sig0("ZeroAddress()"));
        token.rescueNative(address(0), 1);

        vm.prank(OWNER);
        token.rescueNative(address(0xCAFE), 2 ether);
        _eq(address(0xCAFE).balance, 2 ether, "rescued");
        _eq(address(token).balance, 1 ether, "rest");

        RejectsNative rej = new RejectsNative();
        vm.prank(OWNER);
        _revert(_sig0("RescueFailed()"));
        token.rescueNative(address(rej), 1 ether);
    }

    // ------------------------------------------------------------------ fuzz : la somme des soldes ne bouge jamais
    function testFuzz_transferConservesSupply(uint256 amount, address to) public {
        if (to == address(0) || to == address(token) || to == OWNER) return;
        amount = amount % (50_000_000 * U + 1);
        uint256 ownerBefore = token.balanceOf(OWNER);
        uint256 toBefore = token.balanceOf(to);
        vm.prank(OWNER);
        token.transfer(to, amount);
        _eq(token.balanceOf(OWNER), ownerBefore - amount, "owner debited");
        _eq(token.balanceOf(to), toBefore + amount, "recipient credited");
        _eq(token.totalSupply(), 50_000_000 * U, "supply unchanged");
    }

    function testFuzz_mintNeverExceedsCap(uint256 amount) public {
        amount = amount % (2_000_000_000 * U);
        if (amount == 0) return;
        uint256 room = token.MAX_SUPPLY() - token.totalSupply();
        vm.prank(OWNER);
        (bool ok,) = address(token).call(abi.encodeWithSignature("mint(address,uint256)", A, amount));
        require(ok == (amount <= room), "mint succeeds exactly when it fits under the cap");
        require(token.totalSupply() <= token.MAX_SUPPLY(), "cap never exceeded");
    }
}
