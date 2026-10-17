// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  YOR Experimental USDT (contrôlé) — YOR-USDT
 * @notice JETON EXPERIMENTAL DE TEST. Ce n'est PAS Tether USDT et il n'a aucun lien avec Tether. Il ne représente
 *         aucune valeur garantie. NON AUDITE. A utiliser uniquement sur les réseaux de test (Shasta, Nile, réseaux
 *         locaux). Ne jamais déployer sur un mainnet sans audit indépendant et validation manuelle du propriétaire.
 *
 *         ERC-20 / TRC-20 avec : plafond d'émission, pause, burn, permit (EIP-2612), liste noire (avec destruction
 *         des fonds d'une adresse listée), récupération de jetons / de monnaie native envoyés par erreur, et
 *         propriété en deux temps. Aucune dépendance : un seul fichier, compilable avec solc 0.8.19 / evm istanbul
 *         (comme foundry.toml : pas de PUSH0, MCOPY, TLOAD).
 *
 *         Ce contrat est SEPARE de YORExperimentalUSDT (le jeton à lots déjà déployé sur Nile) : il ne le remplace
 *         pas et ne le modifie pas.
 *
 * @dev    Nom et symbole sont donnés au déploiement mais DOIVENT garder la marque YOR : le nom commence par « YOR »
 *         suivi d'une espace, le symbole par « YOR- ». Le constructeur refuse tout autre nom (en particulier
 *         « TETHER » / « USDT » seuls) : un jeton de test ne doit jamais se faire passer pour un autre.
 *
 *         Différences voulues avec le fichier d'origine (qui utilisait OpenZeppelin 5 / solc 0.8.24) :
 *          - destroyBlackFunds fonctionne réellement. Dans l'original, la brûlure passait par _update, qui refuse
 *            tout transfert depuis une adresse listée : la fonction revenait toujours en erreur.
 *          - un jeton envoyé au contrat lui-même est refusé (il serait bloqué à jamais : rescueERC20 refuse le
 *            jeton lui-même).
 *          - un dépensier (spender) listé ne peut plus utiliser une allocation faite avant son inscription.
 *          - signatures permit « malléables » (s haut, v hors 27/28) refusées ; le séparateur de domaine est recalculé
 *            à chaque appel (pas de cache à invalider si l'identifiant de chaîne change).
 *          - propriétaire candidat listé : acceptOwnership refusé.
 *
 *         Pause : bloque transfer, transferFrom, mint et burn. N'empêche pas approve, permit, ni les fonctions
 *         du propriétaire (liste noire, destroyBlackFunds, récupération), pour qu'il puisse agir en urgence.
 */
contract YORExperimentalUSDTControlled {
    // ------------------------------------------------------------------ constantes
    uint8 public constant decimals = 6;
    uint256 private constant _ONE_TOKEN = 10 ** 6;

    uint256 public constant INITIAL_SUPPLY = 50_000_000 * _ONE_TOKEN;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * _ONE_TOKEN;

    uint256 private constant _MAX_NAME_LENGTH = 64;
    uint256 private constant _MAX_SYMBOL_LENGTH = 16;

    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _VERSION_HASH = keccak256(bytes("1"));
    // moitié de l'ordre de la courbe secp256k1 (EIP-2 : rejet des signatures malléables)
    uint256 private constant _SECP256K1N_HALF = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    // ------------------------------------------------------------------ état
    string private _name;
    string private _symbol;

    uint256 public totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => uint256) public nonces;

    address public owner;
    address public pendingOwner;

    bool public paused;
    mapping(address => bool) private _blacklisted;

    uint256 private _lock = 1; // 1 = libre, 2 = verrouillé (anti-réentrance)

    // ------------------------------------------------------------------ erreurs
    error ZeroAddress();
    error ZeroAmount();
    error InvalidRecipient();
    error InvalidBrand();
    error NotOwner(address caller);
    error NotPendingOwner(address caller);
    error RenounceDisabled();
    error EnforcedPause();
    error ExpectedPause();
    error CapExceeded();
    error InsufficientBalance();
    error InsufficientAllowance();
    error AccountBlacklisted(address account);
    error AlreadyBlacklisted(address account);
    error NotBlacklisted(address account);
    error CannotBlacklistOwner();
    error PermitExpired();
    error InvalidSignature();
    error CannotRescueSelf();
    error RescueFailed();
    error Reentrancy();

    // ------------------------------------------------------------------ événements
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);
    event AddedBlackList(address indexed account);
    event RemovedBlackList(address indexed account);
    event DestroyedBlackFunds(address indexed account, uint256 amount);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event NativeRescued(address indexed to, uint256 amount);
    event NativeReceived(address indexed from, uint256 amount);

    // ------------------------------------------------------------------ modificateurs
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(string memory name_, string memory symbol_, address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (!_hasBrand(name_, "YOR ", _MAX_NAME_LENGTH) || !_hasBrand(symbol_, "YOR-", _MAX_SYMBOL_LENGTH)) {
            revert InvalidBrand();
        }
        _name = name_;
        _symbol = symbol_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
        _update(address(0), initialOwner, INITIAL_SUPPLY);
    }

    // ================================================================== métadonnées
    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    // ================================================================== ERC-20
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address holder, address spender) external view returns (uint256) {
        return _allowances[holder][spender];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (_blacklisted[msg.sender]) revert AccountBlacklisted(msg.sender);
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        return true;
    }

    // ================================================================== émission / destruction
    /// @notice Crée `amount` pour `to`, dans la limite de MAX_SUPPLY. Réservé au propriétaire.
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (to == address(this)) revert InvalidRecipient();
        if (amount == 0) revert ZeroAmount();
        _update(address(0), to, amount);
    }

    function burn(uint256 amount) external {
        _update(msg.sender, address(0), amount);
    }

    function burnFrom(address account, uint256 amount) external {
        if (_blacklisted[msg.sender]) revert AccountBlacklisted(msg.sender);
        _spendAllowance(account, msg.sender, amount);
        _update(account, address(0), amount);
    }

    // ================================================================== pause
    function pause() external onlyOwner {
        if (paused) revert EnforcedPause();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert ExpectedPause();
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ================================================================== liste noire
    function isBlacklisted(address account) external view returns (bool) {
        return _blacklisted[account];
    }

    function addBlackList(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        if (account == owner) revert CannotBlacklistOwner();
        if (_blacklisted[account]) revert AlreadyBlacklisted(account);
        _blacklisted[account] = true;
        emit AddedBlackList(account);
    }

    function removeBlackList(address account) external onlyOwner {
        if (!_blacklisted[account]) revert NotBlacklisted(account);
        _blacklisted[account] = false;
        emit RemovedBlackList(account);
    }

    /// @notice Détruit TOUT le solde d'une adresse listée. Fonctionne aussi pendant la pause (action d'urgence).
    function destroyBlackFunds(address account) external onlyOwner {
        if (!_blacklisted[account]) revert NotBlacklisted(account);
        uint256 bal = _balances[account];
        if (bal == 0) revert ZeroAmount();
        unchecked {
            _balances[account] = 0;
            totalSupply -= bal; // bal <= totalSupply par construction
        }
        emit Transfer(account, address(0), bal);
        emit DestroyedBlackFunds(account, bal);
    }

    // ================================================================== permit (EIP-2612)
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(_EIP712_DOMAIN_TYPEHASH, keccak256(bytes(_name)), _VERSION_HASH, block.chainid, address(this))
        );
    }

    function permit(
        address holder,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp > deadline) revert PermitExpired();
        _checkPermitSignature(holder, spender, value, deadline, v, r, s);
        unchecked {
            nonces[holder] += 1; // ne peut pas déborder en pratique (2^256 signatures)
        }
        _approve(holder, spender, value);
    }

    // ================================================================== propriété en deux temps
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner(msg.sender);
        if (_blacklisted[msg.sender]) revert AccountBlacklisted(msg.sender);
        address previous = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, msg.sender);
    }

    /// @dev Désactivé : un jeton sans propriétaire ne pourrait plus être mis en pause ni corrigé.
    function renounceOwnership() external pure {
        revert RenounceDisabled();
    }

    // ================================================================== récupération
    /// @notice Récupère un jeton ERC-20 / TRC-20 envoyé par erreur AU CONTRAT (pas le jeton lui-même).
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(this)) revert CannotRescueSelf();
        if (to == address(0)) revert ZeroAddress();
        if (token.code.length == 0) revert RescueFailed();
        // transfer(address,uint256) ; certains jetons ne renvoient rien, d'autres renvoient un bool
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (ret.length != 0 && (ret.length < 32 || !abi.decode(ret, (bool))))) revert RescueFailed();
        emit TokensRescued(token, to, amount);
    }

    /// @notice Récupère la monnaie native envoyée par erreur au contrat.
    function rescueNative(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert RescueFailed();
        emit NativeRescued(to, amount);
    }

    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
    }

    // ================================================================== interne
    function _transfer(address from, address to, uint256 value) private {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (to == address(this)) revert InvalidRecipient();
        _update(from, to, value);
    }

    /// @dev Point unique de mouvement des jetons (transfert, émission si from == 0, destruction si to == 0).
    function _update(address from, address to, uint256 value) private {
        if (paused) revert EnforcedPause();
        if (from != address(0) && _blacklisted[from]) revert AccountBlacklisted(from);
        if (to != address(0) && _blacklisted[to]) revert AccountBlacklisted(to);
        if (from == address(0)) {
            uint256 newSupply = totalSupply + value;
            if (newSupply > MAX_SUPPLY) revert CapExceeded();
            totalSupply = newSupply;
        } else {
            uint256 bal = _balances[from];
            if (bal < value) revert InsufficientBalance();
            unchecked {
                _balances[from] = bal - value;
            }
        }
        if (to == address(0)) {
            unchecked {
                totalSupply -= value; // value <= solde de from <= totalSupply
            }
        } else {
            unchecked {
                _balances[to] += value; // somme des soldes = totalSupply <= MAX_SUPPLY : aucun débordement
            }
        }
        emit Transfer(from, to, value);
    }

    function _approve(address holder, address spender, uint256 value) private {
        if (holder == address(0) || spender == address(0)) revert ZeroAddress();
        if (_blacklisted[holder]) revert AccountBlacklisted(holder);
        if (_blacklisted[spender]) revert AccountBlacklisted(spender);
        _allowances[holder][spender] = value;
        emit Approval(holder, spender, value);
    }

    function _spendAllowance(address holder, address spender, uint256 value) private {
        uint256 current = _allowances[holder][spender];
        if (current != type(uint256).max) {
            if (current < value) revert InsufficientAllowance();
            unchecked {
                _allowances[holder][spender] = current - value;
            }
        }
    }

    /// @dev Signature EIP-712 de `holder` sur (holder, spender, value, nonce courant, deadline). Rejette s haut et v hors 27/28.
    function _checkPermitSignature(
        address holder,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) private view {
        if (uint256(s) > _SECP256K1N_HALF || (v != 27 && v != 28)) revert InvalidSignature();
        address signer = ecrecover(_permitDigest(holder, spender, value, deadline), v, r, s);
        if (signer == address(0) || signer != holder) revert InvalidSignature();
    }

    function _permitDigest(address holder, address spender, uint256 value, uint256 deadline)
        private
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, holder, spender, value, nonces[holder], deadline));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
    }

    /// @dev Vrai si `s` commence par `prefix`, est strictement plus long que lui et ne dépasse pas `maxLen` octets.
    function _hasBrand(string memory s, string memory prefix, uint256 maxLen) private pure returns (bool) {
        bytes memory b = bytes(s);
        bytes memory p = bytes(prefix);
        if (b.length <= p.length || b.length > maxLen) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (b[i] != p[i]) return false;
        }
        return true;
    }
}
