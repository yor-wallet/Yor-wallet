// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  YOR Experimental USDT (YOR-USDT)
 * @notice JETON EXPERIMENTAL DE TEST pour TRON (compatible TRC-20). Ce n'est PAS Tether USDT et il n'a
 *         aucun lien avec Tether. Il ne représente aucune valeur garantie.
 *         NON AUDITE. A utiliser uniquement sur les réseaux de test (Shasta, Nile).
 *         Ne jamais déployer sur le mainnet sans audit indépendant et validation manuelle du propriétaire.
 *
 * Règles (identiques au modèle de référence model/lot-model.mjs, validé par tests) :
 *  - 6 décimales. Aucun utilisateur ne peut créer de jetons : mint réservé à MINTER_ROLE, burn à BURNER_ROLE.
 *  - Les jetons vivent dans des LOTS explicites (TokenLot). Un lot peut avoir une échéance (expiresAt, 0 = aucune).
 *  - Consommation FIFO par ordre d'arrivée ; un lot échu n'est plus dépensable.
 *  - Un transfert crée chez le destinataire un lot qui HERITE de l'échéance d'origine
 *    (fusion avec le dernier lot du destinataire si l'échéance est identique).
 *  - Aucune boucle non bornée : une opération touche au plus MAX_LOTS_PER_OP lots.
 *  - L'expiration n'a lieu que par expireLots / expireLotsFrom (accessibles à tous), uniquement sur des lots
 *    réellement échus, avec l'événement Expiration. Rien n'expire sans lot ni échéance enregistrés.
 *  - balanceOf = total brut des lots restants (y compris échus non encore traités) ;
 *    availableBalanceOf = dépensable ; expiredBalanceOf = échu non encore brûlé.
 */
contract YORExperimentalUSDT {
    // ------------------------------------------------------------------ métadonnées
    string public constant name = "YOR Experimental USDT";
    string public constant symbol = "YOR-USDT";
    uint8 public constant decimals = 6;

    // ------------------------------------------------------------------ rôles
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender], "YORUSDT: missing role");
        _;
    }

    // ------------------------------------------------------------------ lots
    struct TokenLot {
        uint256 id;
        address owner;
        uint256 amount;          // total crédité dans ce lot (augmente en cas de fusion)
        uint64 createdAt;
        uint64 expiresAt;        // 0 = sans échéance
        uint256 remainingAmount; // reste dépensable ou en attente d'expiration
    }

    uint256 public constant MAX_LOTS_PER_OP = 50;
    uint256 public constant MAX_VIEW_LOTS = 500;

    uint256 private _totalSupply;
    uint256 public nextLotId = 1;

    mapping(uint256 => TokenLot) private _lots;
    mapping(address => uint256[]) private _lotIds;   // lots d'un propriétaire, par ordre d'arrivée
    mapping(address => uint256) private _head;       // premier lot susceptible d'avoir un reste
    mapping(address => uint256) private _balances;   // somme des remainingAmount
    mapping(address => mapping(address => uint256)) private _allowances;

    // ------------------------------------------------------------------ événements
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount, uint256 indexed lotId, uint64 expiresAt);
    event Burn(address indexed from, uint256 amount);
    event Expiration(address indexed owner, uint256 indexed lotId, uint256 amount);
    event LotCredited(address indexed owner, uint256 indexed lotId, uint256 amount, uint64 expiresAt, bool created);
    event LotDebited(address indexed owner, uint256 indexed lotId, uint256 amount);

    constructor(address admin) {
        require(admin != address(0), "YORUSDT: admin is zero");
        _grant(DEFAULT_ADMIN_ROLE, admin);
    }

    // ================================================================== rôles
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grant(role, account);
    }

    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_roles[role][account]) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    function renounceRole(bytes32 role) external {
        if (_roles[role][msg.sender]) {
            _roles[role][msg.sender] = false;
            emit RoleRevoked(role, msg.sender, msg.sender);
        }
    }

    function _grant(bytes32 role, address account) private {
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    // ================================================================== TRC-20
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "YORUSDT: approve to zero");
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 cur = _allowances[from][msg.sender];
        if (cur != type(uint256).max) {
            require(cur >= amount, "YORUSDT: insufficient allowance");
            _allowances[from][msg.sender] = cur - amount;
        }
        _move(from, to, amount);
        return true;
    }

    // ================================================================== émission / destruction
    /// @notice Crée un lot pour `to`. `expiresAt` = 0 pour un lot sans échéance. Réservé à MINTER_ROLE.
    function mint(address to, uint256 amount, uint64 expiresAt) external onlyRole(MINTER_ROLE) returns (uint256 lotId) {
        require(to != address(0), "YORUSDT: mint to zero");
        require(amount > 0, "YORUSDT: zero amount");
        require(expiresAt == 0 || expiresAt > block.timestamp, "YORUSDT: expiry in the past");
        lotId = _credit(to, expiresAt, amount);
        _totalSupply += amount;
        emit Mint(to, amount, lotId, expiresAt);
        emit Transfer(address(0), to, amount);
    }

    /// @notice Brûle des jetons dépensables de `from` (les lots échus partent par expiration). Réservé à BURNER_ROLE.
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        require(amount > 0, "YORUSDT: zero amount");
        _consume(from, amount);
        _totalSupply -= amount;
        emit Burn(from, amount);
        emit Transfer(from, address(0), amount);
    }

    // ================================================================== expiration
    /// @notice Brûle les lots échus de `owner` à partir de la tête, sur au plus `maxLots` lots. Accessible à tous.
    function expireLots(address owner, uint256 maxLots) external returns (uint256) {
        return expireLotsFrom(owner, _head[owner], maxLots);
    }

    /// @notice Idem à partir de l'indice `start` (pagination vers des lots situés derrière des lots non échus).
    function expireLotsFrom(address owner, uint256 start, uint256 maxLots) public returns (uint256 total) {
        require(maxLots > 0 && maxLots <= MAX_LOTS_PER_OP, "YORUSDT: bad maxLots");
        uint256[] storage ids = _lotIds[owner];
        require(start <= ids.length, "YORUSDT: bad start");
        uint256 end = start + maxLots;
        if (end > ids.length) end = ids.length;
        for (uint256 i = start; i < end; i++) {
            TokenLot storage lot = _lots[ids[i]];
            uint256 rem = lot.remainingAmount;
            if (rem > 0 && _isExpired(lot)) {
                lot.remainingAmount = 0;
                _balances[owner] -= rem;
                _totalSupply -= rem;
                total += rem;
                emit Expiration(owner, lot.id, rem);
                emit Transfer(owner, address(0), rem);
            }
        }
        uint256 h = _head[owner];
        uint256 steps = 0;
        while (h < ids.length && steps < MAX_LOTS_PER_OP && _lots[ids[h]].remainingAmount == 0) {
            h++;
            steps++;
        }
        _head[owner] = h;
    }

    // ================================================================== lecture
    function expiredBalanceOf(address owner) public view returns (uint256 sum) {
        uint256[] storage ids = _lotIds[owner];
        uint256 h = _head[owner];
        require(ids.length - h <= MAX_VIEW_LOTS, "YORUSDT: too many lots, use lotsSummary");
        for (uint256 i = h; i < ids.length; i++) {
            TokenLot storage lot = _lots[ids[i]];
            if (lot.remainingAmount > 0 && _isExpired(lot)) sum += lot.remainingAmount;
        }
    }

    function availableBalanceOf(address owner) external view returns (uint256) {
        return _balances[owner] - expiredBalanceOf(owner);
    }

    function lotsSummary(address owner, uint256 start, uint256 count)
        external view returns (uint256 available, uint256 expired, uint256 next)
    {
        uint256[] storage ids = _lotIds[owner];
        uint256 len = ids.length;
        uint256 end = (start >= len) ? len : (count > len - start ? len : start + count);
        for (uint256 i = start; i < end; i++) {
            TokenLot storage lot = _lots[ids[i]];
            if (lot.remainingAmount == 0) continue;
            if (_isExpired(lot)) expired += lot.remainingAmount; else available += lot.remainingAmount;
        }
        next = end;
    }

    function lotCount(address owner) external view returns (uint256) {
        return _lotIds[owner].length;
    }

    function headOf(address owner) external view returns (uint256) {
        return _head[owner];
    }

    function lotAt(address owner, uint256 index) external view returns (TokenLot memory) {
        require(index < _lotIds[owner].length, "YORUSDT: bad index");
        return _lots[_lotIds[owner][index]];
    }

    // ================================================================== interne
    function _isExpired(TokenLot storage lot) private view returns (bool) {
        return lot.expiresAt != 0 && lot.expiresAt <= block.timestamp;
    }

    function _move(address from, address to, uint256 amount) private {
        require(to != address(0), "YORUSDT: transfer to zero");
        require(from != address(0), "YORUSDT: transfer from zero");
        if (amount > 0) {
            (uint64[] memory exps, uint256[] memory takes, uint256 count) = _consume(from, amount);
            for (uint256 k = 0; k < count; k++) {
                _credit(to, exps[k], takes[k]);
            }
        }
        emit Transfer(from, to, amount);
    }

    /// @dev Crédite `amount` avec l'échéance `expiresAt` : fusion avec le dernier lot si même échéance, sinon nouveau lot.
    function _credit(address to, uint64 expiresAt, uint256 amount) private returns (uint256) {
        uint256[] storage ids = _lotIds[to];
        if (ids.length > 0) {
            TokenLot storage tail = _lots[ids[ids.length - 1]];
            if (tail.remainingAmount > 0 && tail.expiresAt == expiresAt) {
                tail.amount += amount;
                tail.remainingAmount += amount;
                _balances[to] += amount;
                emit LotCredited(to, tail.id, amount, expiresAt, false);
                return tail.id;
            }
        }
        uint256 id = nextLotId;
        nextLotId = id + 1;
        _lots[id] = TokenLot({
            id: id,
            owner: to,
            amount: amount,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            remainingAmount: amount
        });
        ids.push(id);
        _balances[to] += amount;
        emit LotCredited(to, id, amount, expiresAt, true);
        return id;
    }

    /// @dev Débite `amount` des lots de `from` : FIFO par arrivée, lots échus ignorés, au plus MAX_LOTS_PER_OP lots visités.
    function _consume(address from, uint256 amount)
        private returns (uint64[] memory exps, uint256[] memory takes, uint256 count)
    {
        exps = new uint64[](MAX_LOTS_PER_OP);
        takes = new uint256[](MAX_LOTS_PER_OP);
        uint256[] storage ids = _lotIds[from];
        uint256 i = _head[from];
        uint256 visited = 0;
        uint256 need = amount;
        while (need > 0) {
            require(i < ids.length, "YORUSDT: insufficient available balance");
            require(visited < MAX_LOTS_PER_OP, "YORUSDT: too many lots");
            TokenLot storage lot = _lots[ids[i]];
            visited++;
            if (lot.remainingAmount == 0) {
                if (i == _head[from]) _head[from] = i + 1;
                i++;
                continue;
            }
            if (_isExpired(lot)) {
                i++;
                continue;
            }
            uint256 take = lot.remainingAmount < need ? lot.remainingAmount : need;
            lot.remainingAmount -= take;
            need -= take;
            _balances[from] -= take;
            exps[count] = lot.expiresAt;
            takes[count] = take;
            count++;
            emit LotDebited(from, lot.id, take);
            if (lot.remainingAmount == 0 && i == _head[from]) _head[from] = i + 1;
            i++;
        }
    }
}
