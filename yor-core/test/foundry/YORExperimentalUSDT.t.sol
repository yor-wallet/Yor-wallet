// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
 * Tests Foundry du contrat YORExperimentalUSDT, sans dépendance (pas de forge-std).
 * Ils reprennent les scénarios du modèle de référence (model/lot-model.mjs, tests/model) pour vérifier que le
 * CONTRAT compilé se comporte comme le modèle : mêmes montants, mêmes messages de revert, mêmes lots.
 * Un échec = un `require` qui revert ; forge affiche le message.
 */
import "../../contracts/YORExperimentalUSDT.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address msgSender) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
}

contract YORExperimentalUSDTTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    YORExperimentalUSDT internal token;

    address internal constant ADMIN = address(0xA0);
    address internal constant MINTER = address(0xA1);
    address internal constant BURNER = address(0xA2);
    address internal constant A = address(0xA);
    address internal constant B = address(0xB);
    address internal constant C = address(0xC);
    uint256 internal constant U = 1e6;
    uint256 internal constant T0 = 1_700_000_000;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Expiration(address indexed owner, uint256 indexed lotId, uint256 amount);

    function setUp() public {
        vm.warp(T0);
        token = new YORExperimentalUSDT(ADMIN);
        bytes32 mr = token.MINTER_ROLE();
        bytes32 br = token.BURNER_ROLE();
        vm.prank(ADMIN);
        token.grantRole(mr, MINTER);
        vm.prank(ADMIN);
        token.grantRole(br, BURNER);
    }

    // ------------------------------------------------------------------ aides
    function _eq(uint256 a, uint256 b, string memory m) internal pure {
        require(a == b, m);
    }

    function _mint(address to, uint256 amount, uint64 exp) internal returns (uint256 id) {
        vm.prank(MINTER);
        id = token.mint(to, amount, exp);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        vm.prank(from);
        token.transfer(to, amount);
    }

    function _tryTransfer(address from, address to, uint256 amount) internal returns (bool ok) {
        vm.prank(from);
        (ok,) = address(token).call(abi.encodeWithSelector(YORExperimentalUSDT.transfer.selector, to, amount));
    }

    // ------------------------------------------------------------------ métadonnées et rôles
    function test_metadata() public view {
        require(keccak256(bytes(token.name())) == keccak256(bytes("YOR Experimental USDT")), "name");
        require(keccak256(bytes(token.symbol())) == keccak256(bytes("YOR-USDT")), "symbol");
        _eq(token.decimals(), 6, "decimals");
        require(token.hasRole(bytes32(0), ADMIN), "admin role");
        require(token.MINTER_ROLE() == keccak256("MINTER_ROLE"), "minter id");
        require(token.BURNER_ROLE() == keccak256("BURNER_ROLE"), "burner id");
        _eq(token.MAX_LOTS_PER_OP(), 50, "max lots per op");
        _eq(token.MAX_VIEW_LOTS(), 500, "max view lots");
        _eq(token.totalSupply(), 0, "initial supply");
    }

    function test_constructorRejectsZeroAdmin() public {
        vm.expectRevert(bytes("YORUSDT: admin is zero"));
        new YORExperimentalUSDT(address(0));
    }

    function test_onlyAdminGrantsAndRevokesRoles() public {
        bytes32 mr = token.MINTER_ROLE();
        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: missing role"));
        token.grantRole(mr, A);
        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: missing role"));
        token.revokeRole(mr, MINTER);

        vm.prank(ADMIN);
        token.revokeRole(mr, MINTER);
        require(!token.hasRole(mr, MINTER), "revoked");
        vm.prank(MINTER);
        vm.expectRevert(bytes("YORUSDT: missing role"));
        token.mint(A, 1, 0);

        vm.prank(ADMIN);
        token.grantRole(mr, MINTER);
        require(token.hasRole(mr, MINTER), "granted again");
    }

    function test_renounceRole() public {
        bytes32 br = token.BURNER_ROLE();
        vm.prank(BURNER);
        token.renounceRole(br);
        require(!token.hasRole(br, BURNER), "renounced");
    }

    function test_noUserCanCreateOrDestroyTokens() public {
        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: missing role"));
        token.mint(A, 1_000 * U, 0);
        _mint(A, 10 * U, 0);
        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: missing role"));
        token.burn(A, 1);
        _eq(token.totalSupply(), 10 * U, "supply unchanged");
    }

    // ------------------------------------------------------------------ mint
    function test_mintValidation() public {
        vm.prank(MINTER);
        vm.expectRevert(bytes("YORUSDT: mint to zero"));
        token.mint(address(0), 1, 0);
        vm.prank(MINTER);
        vm.expectRevert(bytes("YORUSDT: zero amount"));
        token.mint(A, 0, 0);
        vm.prank(MINTER);
        vm.expectRevert(bytes("YORUSDT: expiry in the past"));
        token.mint(A, 1, uint64(T0));
        vm.prank(MINTER);
        vm.expectRevert(bytes("YORUSDT: expiry in the past"));
        token.mint(A, 1, uint64(T0 - 1));
    }

    // ------------------------------------------------------------------ test critique : A 1 870 000 -> envoie 50 à B
    function test_criticalA_sends50ToB() public {
        uint256 total = 1_870_000 * U;
        _mint(A, total, 0);
        _eq(token.balanceOf(A), total, "A before");
        _eq(token.totalSupply(), total, "supply before");

        vm.expectEmit(true, true, false, true);
        emit Transfer(A, B, 50 * U);
        _transfer(A, B, 50 * U);

        _eq(token.balanceOf(A), 1_869_950 * U, "A after");
        _eq(token.balanceOf(B), 50 * U, "B after");
        _eq(token.totalSupply(), total, "supply after");
        _eq(token.availableBalanceOf(A), 1_869_950 * U, "A available");
        _eq(token.expiredBalanceOf(A), 0, "A expired");
    }

    // ------------------------------------------------------------------ FIFO et héritage de l'échéance
    function test_fifoAndExpiryInheritance() public {
        _mint(A, 10 * U, uint64(T0 + 100));
        _mint(A, 10 * U, uint64(T0 + 200));
        _transfer(A, B, 15 * U);

        _eq(token.balanceOf(A), 5 * U, "A left");
        _eq(token.balanceOf(B), 15 * U, "B got");
        _eq(token.lotCount(B), 2, "B lots");
        YORExperimentalUSDT.TokenLot memory l0 = token.lotAt(B, 0);
        YORExperimentalUSDT.TokenLot memory l1 = token.lotAt(B, 1);
        _eq(l0.expiresAt, T0 + 100, "B lot0 expiry inherited");
        _eq(l0.remainingAmount, 10 * U, "B lot0 amount");
        _eq(l1.expiresAt, T0 + 200, "B lot1 expiry inherited");
        _eq(l1.remainingAmount, 5 * U, "B lot1 amount");
        // A garde le reste du deuxième lot
        YORExperimentalUSDT.TokenLot memory a1 = token.lotAt(A, 1);
        _eq(a1.remainingAmount, 5 * U, "A lot1 remaining");
        _eq(token.headOf(A), 1, "A head advanced past the empty lot");
    }

    // ------------------------------------------------------------------ lots échus
    function test_expiredLotsAreNotSpendable() public {
        _mint(A, 10 * U, uint64(T0 + 100));
        _mint(A, 10 * U, uint64(T0 + 200));
        vm.warp(T0 + 100); // l'échéance est atteinte quand expiresAt <= timestamp
        _eq(token.balanceOf(A), 20 * U, "raw balance includes unpurged expired lots");
        _eq(token.availableBalanceOf(A), 10 * U, "available");
        _eq(token.expiredBalanceOf(A), 10 * U, "expired");

        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: insufficient available balance"));
        token.transfer(B, 11 * U);

        _transfer(A, B, 10 * U); // exactement le disponible
        _eq(token.balanceOf(B), 10 * U, "B");
        YORExperimentalUSDT.TokenLot memory bl = token.lotAt(B, 0);
        _eq(bl.expiresAt, T0 + 200, "B inherits the non-expired lot's expiry");
    }

    function test_expireLotsIsPermissionlessAndOnlyBurnsExpired() public {
        _mint(A, 10 * U, uint64(T0 + 100));
        _mint(A, 10 * U, uint64(T0 + 200));

        // rien d'échu : rien ne brûle
        vm.prank(C);
        _eq(token.expireLots(A, 50), 0, "nothing expired yet");
        _eq(token.totalSupply(), 20 * U, "supply intact");

        vm.warp(T0 + 100);
        vm.expectEmit(true, true, false, true);
        emit Expiration(A, 1, 10 * U);
        vm.prank(C); // n'importe quel compte
        _eq(token.expireLots(A, 50), 10 * U, "burned");

        _eq(token.balanceOf(A), 10 * U, "balance after purge");
        _eq(token.totalSupply(), 10 * U, "supply after purge");
        _eq(token.expiredBalanceOf(A), 0, "expired after purge");
        _eq(token.headOf(A), 1, "head moved");
        vm.prank(C);
        _eq(token.expireLots(A, 50), 0, "second purge is a no-op");
    }

    function test_expireLotsArguments() public {
        _mint(A, 1, uint64(T0 + 10));
        vm.expectRevert(bytes("YORUSDT: bad maxLots"));
        token.expireLots(A, 0);
        vm.expectRevert(bytes("YORUSDT: bad maxLots"));
        token.expireLots(A, 51);
        vm.expectRevert(bytes("YORUSDT: bad start"));
        token.expireLotsFrom(A, 2, 1);
        _eq(token.expireLotsFrom(A, 1, 1), 0, "start == length is allowed and a no-op");
    }

    function test_expireLotsFromReachesLotsBehindNonExpiredOnes() public {
        _mint(A, 1 * U, uint64(T0 + 1000)); // index 0, échéance lointaine
        _mint(A, 2 * U, uint64(T0 + 10));   // index 1, bientôt échu
        vm.warp(T0 + 10);
        vm.prank(C);
        _eq(token.expireLots(A, 1), 0, "window starts at head (index 0): nothing");
        vm.prank(C);
        _eq(token.expireLotsFrom(A, 1, 1), 2 * U, "paginated purge reaches index 1");
        _eq(token.balanceOf(A), 1 * U, "left");
    }

    // ------------------------------------------------------------------ rien n'expire sans lot ni date
    function test_nothingExpiresWithoutDate() public {
        _mint(A, 100 * U, 0);
        vm.warp(T0 + 3650 days);
        _eq(token.availableBalanceOf(A), 100 * U, "available");
        _eq(token.expiredBalanceOf(A), 0, "expired");
        vm.prank(C);
        _eq(token.expireLots(A, 50), 0, "purge burns nothing");
        _eq(token.totalSupply(), 100 * U, "supply");
        _transfer(A, B, 100 * U); // toujours dépensable
        _eq(token.balanceOf(B), 100 * U, "B");
    }

    // ------------------------------------------------------------------ fusion en queue
    function test_tailMerge() public {
        _mint(A, 1 * U, 0);
        _mint(A, 2 * U, 0);
        _eq(token.lotCount(A), 1, "merged into one lot");
        YORExperimentalUSDT.TokenLot memory l = token.lotAt(A, 0);
        _eq(l.amount, 3 * U, "amount");
        _eq(l.remainingAmount, 3 * U, "remaining");

        _mint(A, 1 * U, uint64(T0 + 500));
        _eq(token.lotCount(A), 2, "different expiry => new lot");

        _transfer(A, B, 4 * U); // vide tout
        _eq(token.balanceOf(A), 0, "empty");
        _mint(A, 1 * U, uint64(T0 + 500));
        _eq(token.lotCount(A), 3, "tail is empty => no merge");
    }

    // ------------------------------------------------------------------ boucles bornées
    function test_boundedLoops() public {
        for (uint256 i = 0; i < 51; i++) {
            _mint(A, 1, uint64(T0 + 1000 + i)); // échéances distinctes => 51 lots
        }
        _eq(token.lotCount(A), 51, "51 lots");

        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: too many lots"));
        token.transfer(B, 51);

        _transfer(A, B, 50); // exactement 50 lots visités
        _eq(token.balanceOf(A), 1, "one unit left");
        _eq(token.balanceOf(B), 50, "B");
        _eq(token.lotCount(B), 50, "B has 50 lots");
    }

    function test_viewGuardAndPagination() public {
        for (uint256 i = 0; i < 501; i++) {
            _mint(A, 1, uint64(T0 + 10_000 + i));
        }
        vm.expectRevert(bytes("YORUSDT: too many lots, use lotsSummary"));
        token.availableBalanceOf(A);
        vm.expectRevert(bytes("YORUSDT: too many lots, use lotsSummary"));
        token.expiredBalanceOf(A);

        (uint256 av1, uint256 ex1, uint256 n1) = token.lotsSummary(A, 0, 300);
        (uint256 av2, uint256 ex2, uint256 n2) = token.lotsSummary(A, n1, 300);
        _eq(av1 + av2, 501, "pages add up");
        _eq(ex1 + ex2, 0, "none expired");
        _eq(n1, 300, "next after page 1");
        _eq(n2, 501, "next after page 2");
        _eq(token.balanceOf(A), 501, "balanceOf still answers");
    }

    function test_lotsSummary() public {
        _mint(A, 1 * U, uint64(T0 + 10));
        _mint(A, 2 * U, uint64(T0 + 20));
        _mint(A, 4 * U, uint64(T0 + 30));
        _mint(A, 8 * U, 0);
        vm.warp(T0 + 20);
        (uint256 av, uint256 ex, uint256 nx) = token.lotsSummary(A, 0, 10);
        _eq(av, 12 * U, "available");
        _eq(ex, 3 * U, "expired");
        _eq(nx, 4, "next");
        (av, ex, nx) = token.lotsSummary(A, 0, 2);
        _eq(av, 0, "page1 available");
        _eq(ex, 3 * U, "page1 expired");
        _eq(nx, 2, "page1 next");
        (av, ex, nx) = token.lotsSummary(A, 2, 10);
        _eq(av, 12 * U, "page2 available");
        _eq(ex, 0, "page2 expired");
        (av, ex, nx) = token.lotsSummary(A, 9, 1);
        _eq(av + ex, 0, "start beyond the end");
        _eq(nx, 4, "next clamps to length");
    }

    // ------------------------------------------------------------------ atomicité
    function test_failedTransferChangesNothing() public {
        _mint(A, 5 * U, uint64(T0 + 100));
        _mint(A, 5 * U, 0);
        require(!_tryTransfer(A, B, 11 * U), "must fail");
        _eq(token.balanceOf(A), 10 * U, "A intact");
        _eq(token.balanceOf(B), 0, "B intact");
        _eq(token.lotCount(B), 0, "no lot created for B");
        YORExperimentalUSDT.TokenLot memory l0 = token.lotAt(A, 0);
        _eq(l0.remainingAmount, 5 * U, "lot0 intact");
        _eq(token.totalSupply(), 10 * U, "supply");
    }

    // ------------------------------------------------------------------ allowance
    function test_allowanceFlow() public {
        _mint(A, 100 * U, 0);
        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: approve to zero"));
        token.approve(address(0), 1);

        vm.prank(A);
        token.approve(B, 30 * U);
        _eq(token.allowance(A, B), 30 * U, "allowance set");

        vm.prank(B);
        token.transferFrom(A, C, 20 * U);
        _eq(token.allowance(A, B), 10 * U, "allowance decreased");
        _eq(token.balanceOf(C), 20 * U, "C");

        vm.prank(B);
        vm.expectRevert(bytes("YORUSDT: insufficient allowance"));
        token.transferFrom(A, C, 11 * U);

        vm.prank(A);
        token.approve(B, type(uint256).max);
        vm.prank(B);
        token.transferFrom(A, C, 5 * U);
        _eq(token.allowance(A, B), type(uint256).max, "infinite allowance unchanged");
    }

    // ------------------------------------------------------------------ cas limites
    function test_zeroAndSelfTransfers() public {
        _mint(A, 10 * U, 0);
        vm.prank(A);
        vm.expectRevert(bytes("YORUSDT: transfer to zero"));
        token.transfer(address(0), 1);

        _transfer(A, B, 0); // montant nul : accepté, aucun lot créé
        _eq(token.lotCount(B), 0, "no lot for a zero transfer");

        _transfer(A, A, 4 * U); // à soi-même : solde et offre inchangés
        _eq(token.balanceOf(A), 10 * U, "self transfer keeps the balance");
        _eq(token.totalSupply(), 10 * U, "supply");
    }

    function test_burn() public {
        _mint(A, 100 * U, 0);
        vm.prank(BURNER);
        token.burn(A, 10 * U);
        _eq(token.balanceOf(A), 90 * U, "A after burn");
        _eq(token.totalSupply(), 90 * U, "supply after burn");

        vm.prank(BURNER);
        vm.expectRevert(bytes("YORUSDT: zero amount"));
        token.burn(A, 0);
        vm.prank(BURNER);
        vm.expectRevert(bytes("YORUSDT: insufficient available balance"));
        token.burn(A, 91 * U);
    }

    // ------------------------------------------------------------------ fuzz
    function testFuzz_transferConservesSupplyAndInheritsExpiry(uint96 mintAmt, uint96 sendAmt, uint32 expOffset) public {
        uint256 m = uint256(mintAmt) + 1;
        uint64 exp = expOffset == 0 ? 0 : uint64(T0 + uint256(expOffset));
        _mint(A, m, exp);
        uint256 s = uint256(sendAmt) % (m + 1);
        _transfer(A, B, s);
        _eq(token.balanceOf(A) + token.balanceOf(B), m, "conservation");
        _eq(token.balanceOf(B), s, "recipient");
        _eq(token.totalSupply(), m, "supply");
        if (s > 0) {
            YORExperimentalUSDT.TokenLot memory l = token.lotAt(B, 0);
            _eq(l.expiresAt, exp, "expiry inherited");
        }
    }

    function testFuzz_expiredNeverSpendable(uint96 amt, uint32 life) public {
        uint256 m = uint256(amt) + 1;
        uint64 exp = uint64(T0 + 1 + uint256(life));
        _mint(A, m, exp);
        vm.warp(uint256(exp)); // exactement à l'échéance : échu
        require(!_tryTransfer(A, B, 1), "expired lot must not be spendable");
        _eq(token.availableBalanceOf(A), 0, "available");
        _eq(token.expiredBalanceOf(A), m, "expired");
        vm.prank(C);
        _eq(token.expireLots(A, 50), m, "purged");
        _eq(token.totalSupply(), 0, "supply");
    }
}

// ====================================================================== invariants (tests à états)
contract Handler {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    YORExperimentalUSDT public token;
    address public minter;
    address public burner;
    address[3] public actors;

    constructor(YORExperimentalUSDT t, address m, address b) {
        token = t;
        minter = m;
        burner = b;
        actors[0] = address(0xAA01);
        actors[1] = address(0xAA02);
        actors[2] = address(0xAA03);
    }

    function mint(uint256 seed, uint96 amount, uint32 expOffset) external {
        address to = actors[seed % 3];
        uint256 amt = (uint256(amount) % 1e12) + 1;
        uint64 exp = expOffset % 4 == 0 ? 0 : uint64(block.timestamp + 1 + (expOffset % 5000));
        vm.prank(minter);
        token.mint(to, amt, exp);
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint96 amount) external {
        address from = actors[fromSeed % 3];
        address to = actors[toSeed % 3];
        uint256 avail;
        try token.availableBalanceOf(from) returns (uint256 a) { avail = a; } catch { return; }
        if (avail == 0) return;
        uint256 amt = uint256(amount) % (avail + 1);
        vm.prank(from);
        try token.transfer(to, amt) {} catch {}
    }

    function burn(uint256 seed, uint96 amount) external {
        address from = actors[seed % 3];
        uint256 avail;
        try token.availableBalanceOf(from) returns (uint256 a) { avail = a; } catch { return; }
        if (avail == 0) return;
        uint256 amt = (uint256(amount) % avail) + 1;
        vm.prank(burner);
        try token.burn(from, amt) {} catch {}
    }

    function expire(uint256 seed, uint8 maxLots) external {
        token.expireLots(actors[seed % 3], (uint256(maxLots) % 50) + 1);
    }

    function warp(uint32 dt) external {
        vm.warp(block.timestamp + (uint256(dt) % 3000));
    }
}

contract YORExperimentalUSDTInvariants {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    YORExperimentalUSDT internal token;
    Handler internal handler;

    function setUp() public {
        vm.warp(1_700_000_000);
        token = new YORExperimentalUSDT(address(this));
        address minter = address(0xA1);
        address burner = address(0xA2);
        bytes32 mr = token.MINTER_ROLE();
        bytes32 br = token.BURNER_ROLE();
        token.grantRole(mr, minter);
        token.grantRole(br, burner);
        handler = new Handler(token, minter, burner);
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariant_supplyEqualsSumOfBalances() public view {
        uint256 s;
        for (uint256 i = 0; i < 3; i++) s += token.balanceOf(handler.actors(i));
        require(s == token.totalSupply(), "supply != sum(balances)");
    }

    function invariant_balanceEqualsSumOfLotsAndLotsAreConsistent() public view {
        for (uint256 i = 0; i < 3; i++) {
            address a = handler.actors(i);
            uint256 n = token.lotCount(a);
            uint256 sum;
            for (uint256 j = 0; j < n; j++) {
                YORExperimentalUSDT.TokenLot memory l = token.lotAt(a, j);
                require(l.owner == a, "lot owner");
                require(l.remainingAmount <= l.amount, "remaining > amount");
                sum += l.remainingAmount;
            }
            require(sum == token.balanceOf(a), "balance != sum(lots)");
            uint256 h = token.headOf(a);
            require(h <= n, "head beyond lots");
            for (uint256 j = 0; j < h; j++) {
                require(token.lotAt(a, j).remainingAmount == 0, "lot before head is not empty");
            }
        }
    }

    function invariant_availablePlusExpiredEqualsBalance() public view {
        for (uint256 i = 0; i < 3; i++) {
            address a = handler.actors(i);
            require(token.availableBalanceOf(a) + token.expiredBalanceOf(a) == token.balanceOf(a), "available + expired != balance");
            (uint256 av, uint256 ex,) = token.lotsSummary(a, 0, token.lotCount(a));
            require(av + ex == token.balanceOf(a), "lotsSummary != balance");
        }
    }
}
