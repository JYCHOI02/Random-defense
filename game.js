// =====================================================
// CANVAS
// =====================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");


// =====================================================
// UI
// =====================================================

const hpText = document.getElementById("hp");
const goldText = document.getElementById("gold");
const waveText = document.getElementById("wave");
const startButton = document.getElementById("startButton");


// =====================================================
// MAP SETTINGS
// =====================================================

const COLS = 15;
const ROWS = 9;
const TILE_SIZE = 60;

canvas.width = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;


// =====================================================
// GAME STATE
// =====================================================

let gameRunning = false;

let gameState = "menu"; // menu / howto / playing / ended
let gameResult = null;  // clear / gameover
let enemiesDefeated = 0;
let waveEnemiesSpawned = 0;
let waveEnemiesDefeated = 0;
let waveActive = false;
let waveBossDefeated = false;
let waveClearTimer = null;
let spawnTimer = null;

// 일시정지(메뉴) / 게임 속도
let gamePaused = false;
let gameSpeed = 1; // 0, 1, 2

// spawnTimer / waveClearTimer 를 일시정지했다가
// 정확히 남은 시간만큼 이어서 재개하기 위한 정보
let spawnTimerCallback = null;
let spawnTimerExpiresAt = null;
let spawnTimerRemaining = null;

let waveClearCallback = null;
let waveClearExpiresAt = null;
let waveClearRemaining = null;

const TOTAL_WAVES = 5;
const WAVE_ENEMIES = [15, 21, 27, 36, 45];

let baseHP = 100;
let gold = 100;
let wave = 1;

// =====================================================
// RUN STATISTICS / LEADERBOARD
// =====================================================

let totalGoldSpent = 0;

let summonedByRarity = {
    normal: 0,
    rare: 0,
    unique: 0,
    legendary: 0,
    superLegendary: 0
};

let currentRunSaved = false;

const LEADERBOARD_STORAGE_KEY =
    "towerDefenseGoldLeaderboard_v1";

function getLeaderboard() {
    try {
        const raw =
            localStorage.getItem(
                LEADERBOARD_STORAGE_KEY
            );

        if (!raw) return [];

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter(item =>
                item &&
                Number.isFinite(item.goldSpent)
            )
            .sort((a, b) =>
                a.goldSpent - b.goldSpent
            )
            .slice(0, 10);

    } catch (error) {
        console.warn(
            "리더보드 데이터를 불러오지 못했습니다.",
            error
        );
        return [];
    }
}

function saveLeaderboardRecord() {

    if (currentRunSaved) {
        return;
    }

    const record = {
        id:
            Date.now() +
            Math.random(),

        goldSpent:
            totalGoldSpent,

        normal:
            summonedByRarity.normal,

        rare:
            summonedByRarity.rare,

        unique:
            summonedByRarity.unique,

        legendary:
            summonedByRarity.legendary,

        superLegendary:
            summonedByRarity.superLegendary,

        result:
            gameResult,

        date:
            new Date().toLocaleString("ko-KR")
    };

    const leaderboard =
        getLeaderboard();

    leaderboard.push(record);

    leaderboard.sort(
        (a, b) =>
            a.goldSpent - b.goldSpent
    );

    try {
        localStorage.setItem(
            LEADERBOARD_STORAGE_KEY,
            JSON.stringify(
                leaderboard.slice(0, 10)
            )
        );
        currentRunSaved = true;
    } catch (error) {
        console.warn(
            "리더보드 저장에 실패했습니다.",
            error
        );
    }
}


// =====================================================
// OBJECTS
// =====================================================

const towers = [];
const enemies = [];
const bullets = [];
const effects = [];


// =====================================================
// MOUSE STATE
// =====================================================

let mouseCol = -1;
let mouseRow = -1;

let hoveredTower = null;
let selectedTower = null;
let showStats = false;
let currentRarityCounts = {normal:0, rare:0, unique:0, legendary:0, super:0};


// =====================================================
// TOWER SETTINGS
// =====================================================

const TOWER_COST = 40;          // 타워 소환 비용
const MAX_INVENTORY = 8;

// 타워 종류
const towerTypes = {
    basic: {
        name: "BASIC",
        damage: 1.00,
        range: 1.00,
        fireRate: 1.00,
        splash: 0
    },

    cannon: {
        name: "CANNON",
        damage: 1.80,
        range: 0.90,
        fireRate: 1.45,
        splash: 0
    },

    splash: {
        name: "SPLASH",
        damage: 0.75,
        range: 0.95,
        fireRate: 1.15,
        splash: 48
    }
};

// 등급 확률: 합계 100%
const towerRarities = {
    normal: {
        name: "NORMAL",
        shortName: "N",
        chance: 59.9,
        multiplier: 1.0,
        color: "#c9c9c9",
        sellPrice: 20
    },

    rare: {
        name: "RARE",
        shortName: "R",
        chance: 25.0,
        multiplier: 1.5,
        color: "#4da3ff",
        sellPrice: 30
    },

    unique: {
        name: "UNIQUE",
        shortName: "U",
        chance: 13.0,
        multiplier: 1.8,
        color: "#b56cff",
        sellPrice: 60
    },

    legendary: {
        name: "LEGENDARY",
        shortName: "L",
        chance: 2.0,
        multiplier: 5.0,
        color: "#ffd34d",
        sellPrice: 100
    },

    superLegendary: {
        name: "SUPER LEGEND",
        shortName: "SL",
        chance: 0.1,
        multiplier: 20.0,
        color: "#ff4d7d",
        sellPrice: 1000
    }
};

const rarityOrder = [
    "normal",
    "rare",
    "unique",
    "legendary",
    "superLegendary"
];

// 소환된 타워를 보관하는 인벤토리
const towerInventory = [];

// 드래그 중인 타워
let draggingTower = null;
let dragX = 0;
let dragY = 0;

// 판매 버튼에 마우스가 올라가 있는 인벤토리 인덱스
let hoveredSellIndex = -1;

// 카드가 배치된 하단 영역
const inventoryArea = {
    x: 15,
    y: canvas.height - 78,
    width: canvas.width - 205,
    height: 63
};

// 소환 버튼
const summonButton = {
    x: canvas.width - 175,
    y: canvas.height - 78,
    width: 160,
    height: 63
};

const towerLevels = {
    1: {
        damage: 10,
        range: 125,
        fireRate: 35,
        upgradeCost: 60
    },

    2: {
        damage: 18,
        range: 140,
        fireRate: 28,
        upgradeCost: 120
    },

    3: {
        damage: 30,
        range: 160,
        fireRate: 20,
        upgradeCost: 0
    }
};


// =====================================================
// TOWER RANDOM SUMMON
// =====================================================

function rollTowerRarity() {

    const roll = Math.random() * 100;
    let accumulated = 0;

    for (const rarityKey of rarityOrder) {

        accumulated +=
            towerRarities[rarityKey].chance;

        if (roll < accumulated) {
            return rarityKey;
        }
    }

    return "normal";
}


function rollTowerType() {

    const types = [
        "basic",
        "cannon",
        "splash"
    ];

    return types[
        Math.floor(
            Math.random() * types.length
        )
    ];
}


function summonTower() {

    if (!gameRunning) return;

    if (towerInventory.length >= MAX_INVENTORY) {
        return;
    }

    if (gold < TOWER_COST) {
        return;
    }

    gold -= TOWER_COST;
    totalGoldSpent += TOWER_COST;

    const typeKey =
        rollTowerType();

    const rarityKey =
        rollTowerRarity();

    summonedByRarity[rarityKey] =
        (summonedByRarity[rarityKey] || 0) + 1;

    const rarity =
        towerRarities[rarityKey];

    const type =
        towerTypes[typeKey];

    towerInventory.push({

        id:
            Date.now() +
            Math.random(),

        type: typeKey,
        rarity: rarityKey,

        level: 1,

        damage:
            towerLevels[1].damage *
            type.damage *
            rarity.multiplier *
            (
                rarityKey === "superLegendary"
                    ? 3
                    : 1
            ),

        range:
            towerLevels[1].range *
            type.range *
            (
                rarityKey === "superLegendary"
                    ? 2.5
                    : 1 +
                        (
                            rarity.multiplier - 1
                        ) * 0.12
            ),

        fireRate:
            towerLevels[1].fireRate *
            type.fireRate /
            (
                rarityKey === "superLegendary"
                    ? 3
                    : rarity.multiplier
            ),

        splashRadius:
            type.splash *
            (
                rarityKey === "superLegendary"
                    ? 2.5
                    : 1 +
                        (
                            rarity.multiplier - 1
                        ) * 0.15
            )
    });

    updateUI();
    draw();
}


// =====================================================
// MONSTER PATH

// =====================================================

const pathTiles = [

    { col: 0, row: 4 },
    { col: 1, row: 4 },
    { col: 2, row: 4 },
    { col: 3, row: 4 },

    { col: 3, row: 3 },
    { col: 3, row: 2 },

    { col: 4, row: 2 },
    { col: 5, row: 2 },
    { col: 6, row: 2 },
    { col: 7, row: 2 },
    { col: 8, row: 2 },

    { col: 8, row: 3 },
    { col: 8, row: 4 },
    { col: 8, row: 5 },

    { col: 9, row: 5 },
    { col: 10, row: 5 },
    { col: 11, row: 5 },
    { col: 12, row: 5 },
    { col: 13, row: 5 },
    { col: 14, row: 5 }
];


// =====================================================
// TILE CENTER
// =====================================================

function tileCenter(col, row) {

    return {
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2
    };
}


// =====================================================
// TILE CHECK HELPERS
// =====================================================

function isPathTile(col, row) {

    return pathTiles.some(
        (tile) =>
            tile.col === col &&
            tile.row === row
    );
}


function hasTower(col, row) {

    return towers.some(
        (tower) =>
            tower.col === col &&
            tower.row === row
    );
}


// =====================================================
// START GAME
// =====================================================

// 기존 HTML 시작 버튼은 사용하지 않고
// Canvas 중앙 메뉴를 사용합니다.
if (startButton) {
    startButton.style.display = "none";
}


// =====================================================
// 일시정지 가능한 타이머 (스폰 / 웨이브 전환)
// =====================================================

function scheduleSpawnTimer(callback, delay) {

    if (spawnTimer) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
    }

    const speed = gameSpeed || 1;
    const actualDelay = Math.max(0, delay / speed);

    spawnTimerCallback = callback;
    spawnTimerExpiresAt = Date.now() + actualDelay;

    spawnTimer = setTimeout(() => {
        spawnTimer = null;
        spawnTimerExpiresAt = null;
        spawnTimerRemaining = null;

        if (!gameRunning || gameState !== "playing" || isGameFrozen()) {
            return;
        }

        callback();
    }, actualDelay);
}


function scheduleWaveClearTimer(callback, delay) {

    if (waveClearTimer) {
        clearTimeout(waveClearTimer);
        waveClearTimer = null;
    }

    const speed = gameSpeed || 1;
    const actualDelay = Math.max(0, delay / speed);

    waveClearCallback = callback;
    waveClearExpiresAt = Date.now() + actualDelay;

    waveClearTimer = setTimeout(() => {
        waveClearTimer = null;
        waveClearExpiresAt = null;
        waveClearRemaining = null;

        if (!gameRunning || gameState !== "playing" || isGameFrozen()) {
            return;
        }

        callback();
    }, actualDelay);
}


function pauseTimers() {

    if (spawnTimer) {

        clearTimeout(spawnTimer);

        spawnTimerRemaining =
            Math.max(
                0,
                spawnTimerExpiresAt - Date.now()
            );

        spawnTimer = null;
    }

    if (waveClearTimer) {

        clearTimeout(waveClearTimer);

        waveClearRemaining =
            Math.max(
                0,
                waveClearExpiresAt - Date.now()
            );

        waveClearTimer = null;
    }
}


function resumeTimers() {

    if (
        spawnTimer === null &&
        spawnTimerRemaining !== null &&
        spawnTimerCallback
    ) {
        const callback = spawnTimerCallback;
        const remaining = spawnTimerRemaining;
        spawnTimerRemaining = null;
        scheduleSpawnTimer(callback, remaining);
    }

    if (
        waveClearTimer === null &&
        waveClearRemaining !== null &&
        waveClearCallback
    ) {
        const callback = waveClearCallback;
        const remaining = waveClearRemaining;
        waveClearRemaining = null;
        scheduleWaveClearTimer(callback, remaining);
    }
}


function clearAllTimers() {

    if (spawnTimer) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
    }

    if (waveClearTimer) {
        clearTimeout(waveClearTimer);
        waveClearTimer = null;
    }

    spawnTimerCallback = null;
    spawnTimerExpiresAt = null;
    spawnTimerRemaining = null;

    waveClearCallback = null;
    waveClearExpiresAt = null;
    waveClearRemaining = null;
}


// 게임을 멈춰야 하는 상태인지 (모달 일시정지 또는 0배속)
function isGameFrozen() {

    return gamePaused || gameSpeed === 0;
}


// 일시정지 상태 또는 속도가 바뀔 때마다 호출해서
// 타이머를 실제로 멈추거나 다시 이어서 재개합니다.
function syncFreezeState() {

    if (isGameFrozen()) {

        pauseTimers();

    } else {

        resumeTimers();
    }
}


function setGameSpeed(speed) {

    gameSpeed = speed;

    syncFreezeState();

    updateUI();
    draw();
}


function togglePause() {

    if (gameState !== "playing") return;

    gamePaused = !gamePaused;

    syncFreezeState();

    draw();
}


function restartGame() {

    gamePaused = false;

    startGame();
}


function returnToMainMenu() {

    gamePaused = false;
    gameRunning = false;
    gameState = "menu";

    clearAllTimers();

    selectedTower = null;
    draggingTower = null;

    startButton.disabled = false;
    startButton.textContent = "GAME START";

    draw();
}


function startGame() {

    gameRunning = true;
    gameState = "playing";
    gameResult = null;
    enemiesDefeated = 0;
    wave = 1;
    waveEnemiesSpawned = 0;

    totalGoldSpent = 0;

    summonedByRarity = {
        normal: 0,
        rare: 0,
        unique: 0,
        legendary: 0,
        superLegendary: 0
    };

    currentRunSaved = false;
    waveEnemiesDefeated = 0;
    waveActive = false;
    waveBossDefeated = false;

    gamePaused = false;
    gameSpeed = 1;

    clearAllTimers();

    baseHP = 100;
    gold = 100;
    wave = 1;

    towers.length = 0;
    enemies.length = 0;
    bullets.length = 0;
    effects.length = 0;

    towerInventory.length = 0;

    selectedTower = null;
    hoveredTower = null;

    draggingTower = null;
    dragX = 0;
    dragY = 0;

    startButton.disabled = true;
    startButton.textContent = "RUNNING";

    updateUI();

    startWave();

    lastTickTime = Date.now();
}


// =====================================================
// INVENTORY / DRAG HELPERS
// =====================================================

function getInventoryCardRect(index) {

    const gap = 7;
    const cardWidth = 70;

    return {
        x:
            inventoryArea.x +
            index * (cardWidth + gap),

        y: inventoryArea.y,

        width: cardWidth,
        height: inventoryArea.height
    };
}


function getSellButtonRect(index) {

    const cardRect =
        getInventoryCardRect(index);

    const size = 16;

    return {
        x:
            cardRect.x +
            cardRect.width -
            size -
            3,

        y: cardRect.y + 3,

        width: size,
        height: size
    };
}


function sellInventoryTower(index) {

    const towerData =
        towerInventory[index];

    if (!towerData) return;

    const rarity =
        towerRarities[towerData.rarity];

    const sellPrice =
        rarity.sellPrice || 0;

    gold += sellPrice;

    towerInventory.splice(index, 1);

    draggingTower = null;

    updateUI();
    draw();
}


// =====================================================
// 속도 조절 / 일시정지 버튼 위치
// =====================================================

const CONTROL_BAR_X = 15;
const CONTROL_BAR_Y = 68;
const CONTROL_BAR_WIDTH = 228;
const CONTROL_BAR_HEIGHT = 36;

const SPEED_VALUES = [0, 1, 2];


function getSpeedButtonRect(speedValue) {

    const index =
        SPEED_VALUES.indexOf(speedValue);

    const btnWidth = 42;
    const btnHeight = 26;
    const gap = 4;

    return {
        x:
            CONTROL_BAR_X +
            8 +
            index * (btnWidth + gap),

        y: CONTROL_BAR_Y + 5,

        width: btnWidth,
        height: btnHeight
    };
}


function getPauseButtonRect() {

    const lastSpeedRect =
        getSpeedButtonRect(2);

    return {
        x:
            lastSpeedRect.x +
            lastSpeedRect.width +
            10,

        y: CONTROL_BAR_Y + 5,

        width: 68,
        height: 26
    };
}


function getPauseModalButtonRects() {

    const centerX = canvas.width / 2;

    const width = 220;
    const height = 46;
    const gap = 14;

    return {
        resume: {
            x: centerX - width / 2,
            y: 260,
            width,
            height
        },
        restart: {
            x: centerX - width / 2,
            y: 260 + (height + gap),
            width,
            height
        },
        menu: {
            x: centerX - width / 2,
            y: 260 + (height + gap) * 2,
            width,
            height
        }
    };
}


function getCanvasPosition(event) {

    const rect =
        canvas.getBoundingClientRect();

    return {
        x:
            (event.clientX - rect.left) *
            (canvas.width / rect.width),

        y:
            (event.clientY - rect.top) *
            (canvas.height / rect.height)
    };
}


function getBuildPosition(x, y) {

    const col =
        Math.floor(x / TILE_SIZE);

    const row =
        Math.floor(y / TILE_SIZE);

    if (
        col < 0 ||
        row < 0 ||
        col >= COLS ||
        row >= ROWS
    ) {
        return null;
    }

    return {
        col,
        row
    };
}


function canPlaceTower(col, row) {

    if (
        col < 0 ||
        row < 0 ||
        col >= COLS ||
        row >= ROWS
    ) {
        return false;
    }

    if (isPathTile(col, row)) {
        return false;
    }

    if (hasTower(col, row)) {
        return false;
    }

    return true;
}


function placeInventoryTower(towerData, col, row) {

    if (!canPlaceTower(col, row)) {
        return false;
    }

    const center =
        tileCenter(col, row);

    towers.push({

        id: towerData.id,

        col,
        row,

        x: center.x,
        y: center.y,

        type: towerData.type,
        rarity: towerData.rarity,

        level: towerData.level,

        damage: towerData.damage,
        range: towerData.range,
        fireRate: towerData.fireRate,
        splashRadius:
            towerData.splashRadius || 0,

        cooldown: 0
    });

    return true;
}


function startDraggingInventoryTower(index, x, y) {

    const towerData =
        towerInventory[index];

    if (!towerData) return;

    draggingTower = {
        data: towerData,
        index: index
    };

    dragX = x;
    dragY = y;

    selectedTower = null;
}


function finishDraggingTower(x, y) {

    if (!draggingTower) {
        return;
    }

    const position =
        getBuildPosition(x, y);

    if (
        position &&
        canPlaceTower(
            position.col,
            position.row
        )
    ) {

        const placed =
            placeInventoryTower(
                draggingTower.data,
                position.col,
                position.row
            );

        if (placed) {

            towerInventory.splice(
                draggingTower.index,
                1
            );
        }
    }

    draggingTower = null;

    updateUI();
    draw();
}


// =====================================================
// MOUSE MOVE
// =====================================================

canvas.addEventListener("mousemove", (event) => {

    const { x, y } =
        getCanvasPosition(event);

    mouseCol =
        Math.floor(x / TILE_SIZE);

    mouseRow =
        Math.floor(y / TILE_SIZE);

    if (draggingTower) {

        dragX = x;
        dragY = y;

        hoveredTower = null;
        hoveredSellIndex = -1;

        draw();

        return;
    }

    hoveredSellIndex = -1;

    for (
        let i = 0;
        i < towerInventory.length;
        i++
    ) {

        const sellRect =
            getSellButtonRect(i);

        if (
            x >= sellRect.x &&
            x <= sellRect.x + sellRect.width &&
            y >= sellRect.y &&
            y <= sellRect.y + sellRect.height
        ) {

            hoveredSellIndex = i;
            break;
        }
    }

    hoveredTower = null;

    for (const tower of towers) {

        const distance =
            Math.hypot(
                tower.x - x,
                tower.y - y
            );

        if (distance < 25) {

            hoveredTower = tower;
            break;
        }
    }
});


// =====================================================
// MOUSE LEAVE
// =====================================================

canvas.addEventListener("mouseleave", () => {

    mouseCol = -1;
    mouseRow = -1;

    hoveredTower = null;
});


// =====================================================
// MOUSE DRAG
// =====================================================

canvas.addEventListener("mousedown", (event) => {

    if (gameState !== "playing") {
        return;
    }

    if (gamePaused) {
        return;
    }

    const { x, y } =
        getCanvasPosition(event);

    // 소환 버튼
    if (
        x >= summonButton.x &&
        x <= summonButton.x + summonButton.width &&
        y >= summonButton.y &&
        y <= summonButton.y + summonButton.height
    ) {

        summonTower();
        return;
    }

    // 인벤토리 카드 - 판매 버튼
    for (
        let i = 0;
        i < towerInventory.length;
        i++
    ) {

        const sellRect =
            getSellButtonRect(i);

        if (
            x >= sellRect.x &&
            x <= sellRect.x + sellRect.width &&
            y >= sellRect.y &&
            y <= sellRect.y + sellRect.height
        ) {

            sellInventoryTower(i);

            return;
        }
    }

    // 인벤토리 카드 드래그 시작
    for (
        let i = 0;
        i < towerInventory.length;
        i++
    ) {

        const rect =
            getInventoryCardRect(i);

        if (
            x >= rect.x &&
            x <= rect.x + rect.width &&
            y >= rect.y &&
            y <= rect.y + rect.height
        ) {

            startDraggingInventoryTower(
                i,
                x,
                y
            );

            draw();

            return;
        }
    }
});


canvas.addEventListener("mouseup", (event) => {

    if (gameState !== "playing") {
        draggingTower = null;
        return;
    }

    const { x, y } =
        getCanvasPosition(event);

    finishDraggingTower(x, y);
});


// =====================================================
// MOUSE CLICK
// =====================================================

canvas.addEventListener("click", (event) => {

    const rect = canvas.getBoundingClientRect();

    const x =
        (event.clientX - rect.left)
        * (canvas.width / rect.width);

    const y =
        (event.clientY - rect.top)
        * (canvas.height / rect.height);


    // =================================================
    // 초기 화면
    // =================================================

    if (gameState === "menu") {

        const centerX = canvas.width / 2;

        if (
            x >= centerX - 120 &&
            x <= centerX + 120 &&
            y >= 255 &&
            y <= 305
        ) {
            startGame();
            return;
        }

        if (
            x >= centerX - 120 &&
            x <= centerX + 120 &&
            y >= 325 &&
            y <= 375
        ) {
            gameState = "howto";
            draw();
            return;
        }

        return;
    }


    // =================================================
    // 게임 설명 화면
    // =================================================

    if (gameState === "howto") {

        const centerX = canvas.width / 2;

        if (
            x >= centerX - 100 &&
            x <= centerX + 100 &&
            y >= 430 &&
            y <= 480
        ) {
            gameState = "menu";
            draw();
            return;
        }

        return;
    }


    // =================================================
    // 게임 종료 화면
    // =================================================

    if (gameState === "ended") {

        const centerX = canvas.width / 2;

        const popupHeight = 510;

        const popupY =
            (canvas.height - popupHeight) / 2;

        const buttonY =
            popupY + 355;

        // 초기 화면으로
        if (
            x >= centerX - 145 &&
            x <= centerX - 10 &&
            y >= buttonY &&
            y <= buttonY + 50
        ) {
            gameResult = null;
            gameState = "menu";
            draggingTower = null;
            draw();
            return;
        }

        // 바로 재시작
        if (
            x >= centerX + 10 &&
            x <= centerX + 145 &&
            y >= buttonY &&
            y <= buttonY + 50
        ) {
            startGame();
            return;
        }

        return;
    }


    if (!gameRunning) return;


    // =================================================
    // 일시정지 오버레이 (열려있으면 이 버튼들만 반응)
    // =================================================

    if (gamePaused) {

        const buttons =
            getPauseModalButtonRects();

        if (
            x >= buttons.resume.x &&
            x <= buttons.resume.x + buttons.resume.width &&
            y >= buttons.resume.y &&
            y <= buttons.resume.y + buttons.resume.height
        ) {
            togglePause();
            return;
        }

        if (
            x >= buttons.restart.x &&
            x <= buttons.restart.x + buttons.restart.width &&
            y >= buttons.restart.y &&
            y <= buttons.restart.y + buttons.restart.height
        ) {
            restartGame();
            return;
        }

        if (
            x >= buttons.menu.x &&
            x <= buttons.menu.x + buttons.menu.width &&
            y >= buttons.menu.y &&
            y <= buttons.menu.y + buttons.menu.height
        ) {
            returnToMainMenu();
            return;
        }

        // 오버레이가 열려 있는 동안은
        // 다른 어떤 입력도 받지 않습니다.
        return;
    }


    // =================================================
    // 속도 조절 / 일시정지 버튼
    // =================================================

    for (const speedValue of SPEED_VALUES) {

        const rect =
            getSpeedButtonRect(speedValue);

        if (
            x >= rect.x &&
            x <= rect.x + rect.width &&
            y >= rect.y &&
            y <= rect.y + rect.height
        ) {
            setGameSpeed(speedValue);
            return;
        }
    }

    const pauseRect =
        getPauseButtonRect();

    if (
        x >= pauseRect.x &&
        x <= pauseRect.x + pauseRect.width &&
        y >= pauseRect.y &&
        y <= pauseRect.y + pauseRect.height
    ) {
        togglePause();
        return;
    }


    // =================================================
    // 1. 업그레이드 패널 닫기 / 버튼 확인
    // =================================================

    if (selectedTower) {

        const panelWidth = 270;

        const panelX =
            canvas.width - panelWidth - 15;

        const panelY = 15;

        const closeX = panelX + panelWidth - 35;
        const closeY = panelY + 10;
        const closeWidth = 25;
        const closeHeight = 25;

        if (
            x >= closeX &&
            x <= closeX + closeWidth &&
            y >= closeY &&
            y <= closeY + closeHeight
        ) {
            selectedTower = null;
            return;
        }

        const buttonX =
            panelX + 15;

        const buttonY =
            panelY + 148;

        const buttonWidth =
            panelWidth - 30;

        const buttonHeight = 38;


        if (
            x >= buttonX &&
            x <= buttonX + buttonWidth &&
            y >= buttonY &&
            y <= buttonY + buttonHeight
        ) {

            upgradeTower(selectedTower);

            // 중요:
            // 여기서 반드시 종료
            // 타워 설치 코드로 내려가지 않음

            return;
        }
    }


    // =================================================
    // 2. 기존 타워 클릭
    // =================================================

    for (const tower of towers) {

        const distance =
            Math.hypot(
                tower.x - x,
                tower.y - y
            );


        if (distance < 25) {

            selectedTower = tower;

            return;
        }
    }


    // =================================================
    // 3. 맵 좌표 계산
    // =================================================

    const col =
        Math.floor(x / TILE_SIZE);

    const row =
        Math.floor(y / TILE_SIZE);


    if (
        col < 0 ||
        row < 0 ||
        col >= COLS ||
        row >= ROWS
    ) {

        return;
    }


    // =================================================
    // 빈 공간 클릭
    // =================================================

    selectedTower = null;

});


// =====================================================
// UPGRADE TOWER
// =====================================================

function upgradeTower(tower) {

    if (!tower) return;

    if (tower.level >= 3) {
        return;
    }

    const currentLevel =
        tower.level;

    const nextLevel =
        currentLevel + 1;

    const upgradeCost =
        towerLevels[currentLevel].upgradeCost;

    if (gold < upgradeCost) {
        return;
    }

    gold -= upgradeCost;
    totalGoldSpent += upgradeCost;

    tower.level =
        nextLevel;

    const type =
        towerTypes[
            tower.type
        ];

    const rarity =
        towerRarities[
            tower.rarity
        ];

    tower.damage =
        towerLevels[nextLevel].damage *
        type.damage *
        rarity.multiplier *
        (
            tower.rarity === "superLegendary"
                ? 3
                : 1
        );

    tower.range =
        towerLevels[nextLevel].range *
        type.range *
        (
            tower.rarity === "superLegendary"
                ? 2.5
                : 1 +
                    (
                        rarity.multiplier - 1
                    ) * 0.12
        );

    // 업그레이드해도 공격속도(fireRate)는 변하지 않도록
    // 항상 1레벨 기준값을 사용합니다.
    tower.fireRate =
        towerLevels[1].fireRate *
        type.fireRate /
        (
            tower.rarity === "superLegendary"
                ? 3
                : rarity.multiplier
        );

    tower.splashRadius =
        type.splash *
        (
            tower.rarity === "superLegendary"
                ? 2.5
                : 1 +
                    (
                        rarity.multiplier - 1
                    ) * 0.15
        );

    selectedTower = tower;

    updateUI();
    draw();
}


// =====================================================
// ENEMY SPAWN
// =====================================================

function getEnemyStats() {

    const roll = Math.random();

    // 뭉쳐서 나오는 타입
    if (roll < 0.25) {

        return {
            hp: 22 + wave * 5,
            maxHP: 22 + wave * 5,
            speed: 1.35 + wave * 0.06,
            type: "cluster"
        };
    }

    // 후반으로 갈수록 빠른 몬스터 증가
    const fastChance =
        wave === 1 ? 0.05 :
        wave === 2 ? 0.15 :
        wave === 3 ? 0.25 :
        wave === 4 ? 0.35 : 0.45;

    if (Math.random() < fastChance) {

        return {
            hp: 24 + wave * 5,
            maxHP: 24 + wave * 5,
            speed: 1.9 + wave * 0.12,
            type: "fast"
        };
    }

    return {
        hp: 30 + wave * 7,
        maxHP: 30 + wave * 7,
        speed: 1.0 + wave * 0.05,
        type: "normal"
    };
}


function spawnEnemy() {

    if (!gameRunning || !waveActive) {
        return;
    }

    if (
        waveEnemiesSpawned >=
        WAVE_ENEMIES[wave - 1]
    ) {
        return;
    }


    const start =
        tileCenter(
            pathTiles[0].col,
            pathTiles[0].row
        );

    const stats =
        getEnemyStats();


    enemies.push({

        x: start.x,
        y: start.y,

        pathIndex: 1,

        hp: stats.hp,
        maxHP: stats.maxHP,

        speed: stats.speed,

        type: stats.type
    });


    waveEnemiesSpawned++;


    // 후반 웨이브는 적 사이의 간격을 조금 줄여
    // 뭉쳐서 등장하는 구간이 생기도록 합니다.
    const spawnDelay =
        wave === 1
            ? 1000
            : wave === 2
                ? 800
                : wave === 3
                    ? 600
                    : wave === 4
                        ? 480
                        : 380;


    if (
        waveEnemiesSpawned <
        WAVE_ENEMIES[wave - 1]
    ) {

        scheduleSpawnTimer(
            spawnEnemy,
            spawnDelay
        );

    } else {

        spawnTimer = null;

        if (wave === TOTAL_WAVES) {
            scheduleSpawnTimer(
                spawnBoss,
                1400
            );
        }
    }
}


function spawnBoss() {

    if (!gameRunning || wave !== TOTAL_WAVES) {
        return;
    }

    const start =
        tileCenter(
            pathTiles[0].col,
            pathTiles[0].row
        );

    const bossHP = 1200;

    enemies.push({
        x: start.x,
        y: start.y,
        pathIndex: 1,
        hp: bossHP,
        maxHP: bossHP,
        speed: 0.62,
        type: "boss",
        isBoss: true
    });

    spawnTimer = null;
}


function startWave() {

    // 새 웨이브가 시작되면 이전 웨이브 전환 예약을 무효화합니다.
    if (waveClearTimer) {
        clearTimeout(waveClearTimer);
        waveClearTimer = null;
    }
    waveClearCallback = null;
    waveClearExpiresAt = null;
    waveClearRemaining = null;

    if (!gameRunning) {
        return;
    }


    waveActive = true;

    waveEnemiesSpawned = 0;
    waveEnemiesDefeated = 0;
    waveBossDefeated = false;


    updateUI();


    // 한 번에 2~3마리가 나오는 웨이브 구간을 추가합니다.
    // 실제 몬스터 간격도 짧게 설정되어 자연스럽게 뭉칩니다.
    spawnEnemy();
}


function checkWaveClear() {

    if (!gameRunning || !waveActive) {
        return;
    }


    const targetCount =
        WAVE_ENEMIES[wave - 1];


    if (
        waveEnemiesSpawned >= targetCount &&
        enemies.length === 0 &&
        (wave !== TOTAL_WAVES || waveBossDefeated)
    ) {

        waveActive = false;


        if (wave >= TOTAL_WAVES) {

            gameClear();
            return;
        }


        const clearedWave = wave;

        scheduleWaveClearTimer(
            () => {
                // 오래된 타이머가 재개되어도 웨이브를 건너뛰지 않습니다.
                if (
                    !gameRunning ||
                    gameState !== "playing" ||
                    gamePaused ||
                    gameSpeed === 0 ||
                    wave !== clearedWave ||
                    waveActive
                ) {
                    return;
                }

                wave++;
                startWave();
            },
            1800
        );
    }
}


// =====================================================
// ENEMY UPDATE
// =====================================================

function updateEnemies() {

    for (
        let i = enemies.length - 1;
        i >= 0;
        i--
    ) {

        const enemy =
            enemies[i];


        const targetTile =
            pathTiles[
                enemy.pathIndex
            ];


        // 기지 도착
        if (!targetTile) {

            if (enemy.type === "boss") {

                // 보스가 기지에 도달하면 즉시 패배
                baseHP = 0;

            } else {

                baseHP -= 10;
            }

            enemies.splice(i, 1);


            createHitEffect(
                enemy.x,
                enemy.y,
                "#ff5252"
            );


            updateUI();


            if (baseHP <= 0) {

                gameOver();
            }


            continue;
        }


        const target =
            tileCenter(
                targetTile.col,
                targetTile.row
            );


        const dx =
            target.x - enemy.x;

        const dy =
            target.y - enemy.y;


        const distance =
            Math.hypot(dx, dy);


        if (
            distance <=
            enemy.speed
        ) {

            enemy.x =
                target.x;

            enemy.y =
                target.y;

            enemy.pathIndex++;

        } else {

            enemy.x +=
                (dx / distance)
                * enemy.speed;

            enemy.y +=
                (dy / distance)
                * enemy.speed;
        }
    }
}


// =====================================================
// TOWER UPDATE
// =====================================================

function updateTowers() {

    towers.forEach(tower => {

        if (tower.cooldown > 0) {

            tower.cooldown--;

            return;
        }


        let target = null;
        let bestProgress = -Infinity;

        enemies.forEach(enemy => {

            const distance =
                Math.hypot(
                    enemy.x - tower.x,
                    enemy.y - tower.y
                );

            if (
                distance > tower.range ||
                enemy.hp <= 0
            ) {
                return;
            }

            // pathIndex는 현재 목표 지점의 인덱스입니다.
            // 현재 목표 지점까지 남은 거리를 이용해
            // "길을 얼마나 많이 진행했는가"를 계산합니다.
            const nextIndex =
                Math.min(
                    enemy.pathIndex,
                    pathTiles.length - 1
                );

            const nextPoint =
                tileCenter(
                    pathTiles[nextIndex].col,
                    pathTiles[nextIndex].row
                );

            const distanceToNext =
                Math.hypot(
                    nextPoint.x - enemy.x,
                    nextPoint.y - enemy.y
                );

            const progress =
                enemy.pathIndex -
                (
                    distanceToNext /
                    TILE_SIZE
                );

            // 진행도가 가장 높은 몬스터,
            // 즉 기지에 가장 가까운 몬스터를 우선 공격합니다.
            if (
                progress > bestProgress
            ) {

                bestProgress =
                    progress;

                target = enemy;
            }
        });


        if (target) {

            bullets.push({

                x: tower.x,
                y: tower.y,

                target: target,

                speed:
                    tower.type === "cannon"
                        ? 6
                        : 7,

                damage: tower.damage,

                type: tower.type || "basic",

                splashRadius:
                    tower.splashRadius || 0
            });


            tower.cooldown =
                tower.fireRate;
        }
    });
}


// =====================================================
// BULLET UPDATE
// =====================================================

function updateBullets() {

    for (
        let i = bullets.length - 1;
        i >= 0;
        i--
    ) {

        const bullet =
            bullets[i];


        if (
            !enemies.includes(
                bullet.target
            )
        ) {

            bullets.splice(i, 1);

            continue;
        }


        const target =
            bullet.target;


        const dx =
            target.x - bullet.x;

        const dy =
            target.y - bullet.y;


        const distance =
            Math.hypot(dx, dy);


        if (
            distance <=
            bullet.speed + 4
        ) {

            target.hp -=
                bullet.damage;

            createHitEffect(
                target.x,
                target.y,
                bullet.type === "cannon"
                    ? "#ff9f43"
                    : bullet.type === "splash"
                        ? "#b983ff"
                        : "#ffd54f"
            );

            if (
                bullet.type === "splash" &&
                bullet.splashRadius > 0
            ) {

                enemies.forEach(enemy => {

                    if (enemy === target) return;

                    const distance =
                        Math.hypot(
                            enemy.x - target.x,
                            enemy.y - target.y
                        );

                    if (distance <= bullet.splashRadius) {

                        enemy.hp -=
                            bullet.damage * 0.6;

                        createHitEffect(
                            enemy.x,
                            enemy.y,
                            "#b983ff"
                        );
                    }
                });
            }

            bullets.splice(i, 1);

            for (
                let enemyIndex = enemies.length - 1;
                enemyIndex >= 0;
                enemyIndex--
            ) {

                const enemy = enemies[enemyIndex];

                if (enemy.hp <= 0) {

                    enemies.splice(
                        enemyIndex,
                        1
                    );

                    if (enemy.type === "boss") {
                        waveBossDefeated = true;
                        gold += 100;
                    } else {
                        enemiesDefeated++;
                        gold += 3;
                    }
                }
            }

            updateUI();
} else {

            bullet.x +=
                (dx / distance)
                * bullet.speed;

            bullet.y +=
                (dy / distance)
                * bullet.speed;
        }
    }
}


// =====================================================
// EFFECT
// =====================================================

function createHitEffect(
    x,
    y,
    color
) {

    effects.push({

        x: x,
        y: y,

        radius: 4,

        alpha: 1,

        color: color,

        upgrade: false
    });
}


function createUpgradeEffect(
    x,
    y
) {

    effects.push({

        x: x,
        y: y,

        radius: 10,

        alpha: 1,

        color: "#64d8ff",

        upgrade: true
    });
}


function updateEffects() {

    for (
        let i = effects.length - 1;
        i >= 0;
        i--
    ) {

        const effect =
            effects[i];


        effect.radius += 2;


        effect.alpha -=
            effect.upgrade
                ? 0.04
                : 0.08;


        if (effect.alpha <= 0) {

            effects.splice(i, 1);
        }
    }
}


// =====================================================
// DRAW
// =====================================================

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawBackground();
    drawPath();
    drawBase();
    drawEnemies();
    drawBullets();
    drawEffects();
    drawTowers();

    if (gameState === "playing") {
        drawWaveStatus();
        drawControlBar();
        drawTowerInventory();
    }

    if (selectedTower) {
        drawUpgradePanel();
    }

    if (gameState === "menu") {
        drawMainMenu();
    }

    if (gameState === "howto") {
        drawHowToPlay();
    }

    if (gameState === "ended") {
        drawGameEndPopup();
    }

    if (gameState === "playing" && gamePaused) {
        drawPauseOverlay();
    }
}



// =====================================================
// BACKGROUND
// =====================================================

function drawBackground() {

    ctx.fillStyle =
        "#6f9d52";


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}


// =====================================================
// PATH
// =====================================================

function drawPath() {

    if (
        pathTiles.length === 0
    ) {

        return;
    }


    ctx.save();


    const first =
        tileCenter(
            pathTiles[0].col,
            pathTiles[0].row
        );


    // ---------------------------------------------
    // 길 외곽
    // ---------------------------------------------

    ctx.strokeStyle =
        "#8d7a52";

    ctx.lineWidth =
        TILE_SIZE + 6;

    ctx.lineJoin =
        "round";

    ctx.lineCap =
        "round";


    ctx.beginPath();


    ctx.moveTo(
        first.x,
        first.y
    );


    for (
        let i = 1;
        i < pathTiles.length;
        i++
    ) {

        const point =
            tileCenter(
                pathTiles[i].col,
                pathTiles[i].row
            );


        ctx.lineTo(
            point.x,
            point.y
        );
    }


    ctx.stroke();


    // ---------------------------------------------
    // 실제 길
    // ---------------------------------------------

    ctx.strokeStyle =
        "#b6a477";

    ctx.lineWidth =
        TILE_SIZE;

    ctx.lineJoin =
        "round";

    ctx.lineCap =
        "round";


    ctx.beginPath();


    ctx.moveTo(
        first.x,
        first.y
    );


    for (
        let i = 1;
        i < pathTiles.length;
        i++
    ) {

        const point =
            tileCenter(
                pathTiles[i].col,
                pathTiles[i].row
            );


        ctx.lineTo(
            point.x,
            point.y
        );
    }


    ctx.stroke();


    // ---------------------------------------------
    // 길 중앙 장식
    // ---------------------------------------------

    ctx.strokeStyle =
        "rgba(255,255,255,0.15)";

    ctx.lineWidth = 2;

    ctx.lineCap =
        "round";

    ctx.setLineDash([
        8,
        10
    ]);


    ctx.beginPath();


    ctx.moveTo(
        first.x,
        first.y
    );


    for (
        let i = 1;
        i < pathTiles.length;
        i++
    ) {

        const point =
            tileCenter(
                pathTiles[i].col,
                pathTiles[i].row
            );


        ctx.lineTo(
            point.x,
            point.y
        );
    }


    ctx.stroke();


    ctx.setLineDash([]);


    ctx.restore();
}


// =====================================================
// TOWER PREVIEW
// =====================================================

function drawTowerPreview() {

    if (
        mouseCol < 0 ||
        mouseRow < 0 ||
        !gameRunning
    ) {

        return;
    }


    // 기존 타워 위에서는
    // 설치 미리보기 표시하지 않음

    if (hoveredTower) {

        return;
    }


    const x =
        mouseCol * TILE_SIZE;

    const y =
        mouseRow * TILE_SIZE;


    const canBuild =
        !isPathTile(
            mouseCol,
            mouseRow
        ) &&
        !hasTower(
            mouseCol,
            mouseRow
        ) &&
        gold >= TOWER_COST;


    // ---------------------------------------------
    // 마우스가 올라간 칸
    // ---------------------------------------------

    ctx.fillStyle =
        canBuild
            ? "rgba(80,180,255,0.18)"
            : "rgba(255,70,70,0.18)";


    ctx.fillRect(
        x + 2,
        y + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4
    );


    ctx.strokeStyle =
        canBuild
            ? "rgba(140,220,255,0.9)"
            : "rgba(255,100,100,0.9)";


    ctx.lineWidth = 2;


    ctx.strokeRect(
        x + 2,
        y + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4
    );


    // ---------------------------------------------
    // 설치 미리보기
    // ---------------------------------------------

    if (canBuild) {

        const center =
            tileCenter(
                mouseCol,
                mouseRow
            );


        ctx.globalAlpha =
            0.45;


        // 타워 바닥

        ctx.fillStyle =
            "#263238";


        ctx.beginPath();

        ctx.arc(
            center.x,
            center.y,
            20,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // 타워 본체

        ctx.fillStyle =
            "#4569d4";


        ctx.fillRect(
            center.x - 14,
            center.y - 14,
            28,
            28
        );


        // 포신

        ctx.fillStyle =
            "#a9c0ff";


        ctx.fillRect(
            center.x - 4,
            center.y - 27,
            8,
            17
        );


        ctx.globalAlpha = 1;


        // 예상 사거리

        ctx.beginPath();

        ctx.arc(
            center.x,
            center.y,
            towerLevels[1].range,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            "rgba(80,140,255,0.05)";

        ctx.fill();


        ctx.strokeStyle =
            "rgba(120,180,255,0.35)";

        ctx.lineWidth = 1;

        ctx.stroke();
    }
}


// =====================================================
// DRAW TOWERS
// =====================================================

function drawTowers() {

    towers.forEach(tower => {


        // ---------------------------------------------
        // 사거리 표시
        // ---------------------------------------------

        if (
            tower === hoveredTower ||
            tower === selectedTower
        ) {

            ctx.beginPath();

            ctx.arc(
                tower.x,
                tower.y,
                tower.range,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                "rgba(80,140,255,0.08)";

            ctx.fill();


            ctx.strokeStyle =
                "rgba(130,190,255,0.75)";

            ctx.lineWidth = 2;

            ctx.setLineDash([
                6,
                5
            ]);

            ctx.stroke();

            ctx.setLineDash([]);
        }


        // ---------------------------------------------
        // 그림자
        // ---------------------------------------------

        ctx.fillStyle =
            "rgba(0,0,0,0.25)";


        ctx.beginPath();

        ctx.ellipse(
            tower.x,
            tower.y + 17,
            20,
            7,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // ---------------------------------------------
        // 타워 바닥
        // ---------------------------------------------

        ctx.fillStyle =
            "#263238";


        ctx.beginPath();

        ctx.arc(
            tower.x,
            tower.y,
            20,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // ---------------------------------------------
        // 레벨별 색상
        // ---------------------------------------------

        if (tower.level === 1) {

            ctx.fillStyle =
                "#4569d4";

        } else if (tower.level === 2) {

            ctx.fillStyle =
                "#6355d9";

        } else {

            ctx.fillStyle =
                "#d49a35";
        }


        // ---------------------------------------------
        // 타워 본체
        // ---------------------------------------------

        if (tower.type === "cannon") {

            ctx.fillStyle =
                tower.level === 1
                    ? "#b85c45"
                    : tower.level === 2
                        ? "#c96e4e"
                        : "#e0a13c";

        } else if (tower.type === "splash") {

            ctx.fillStyle =
                tower.level === 1
                    ? "#7d5ab8"
                    : tower.level === 2
                        ? "#9369d0"
                        : "#d49a35";

        } else {

            ctx.fillStyle =
                tower.level === 1
                    ? "#4569d4"
                    : tower.level === 2
                        ? "#6355d9"
                        : "#d49a35";
        }

        ctx.fillRect(
            tower.x - 14,
            tower.y - 14,
            28,
            28
        );


        // ---------------------------------------------
        // 포신 / 특수 장치
        // ---------------------------------------------

        if (tower.type === "cannon") {

            ctx.fillStyle = "#ffd0a8";

            ctx.fillRect(
                tower.x - 7,
                tower.y - 28,
                14,
                20
            );

        } else if (tower.type === "splash") {

            ctx.fillStyle = "#e0c8ff";

            ctx.beginPath();

            ctx.arc(
                tower.x,
                tower.y - 10,
                10,
                0,
                Math.PI * 2
            );

            ctx.fill();

        } else {

            ctx.fillStyle = "#a9c0ff";

            ctx.fillRect(
                tower.x - 4,
                tower.y - 27,
                8,
                17
            );
        }


        // ---------------------------------------------
        // 중앙
        // ---------------------------------------------

        ctx.fillStyle =
            "#e1e8ff";


        ctx.beginPath();

        ctx.arc(
            tower.x,
            tower.y,
            5,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // ---------------------------------------------
        // 레벨 숫자
        // ---------------------------------------------

        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "bold 11px Arial";

        ctx.textAlign =
            "center";


        ctx.fillText(
            tower.level,
            tower.x,
            tower.y + 4
        );


        // ---------------------------------------------
        // 3단계 별
        // ---------------------------------------------

        if (tower.level === 3) {

            ctx.fillStyle =
                "#ffe066";

            ctx.font =
                "bold 13px Arial";


            ctx.fillText(
                "★",
                tower.x,
                tower.y - 32
            );
        }
    });
}


// =====================================================
// TOWER INVENTORY + SUMMON UI
// =====================================================

function drawTowerInventory() {

    if (gameState !== "playing") {
        return;
    }

    // 인벤토리 배경
    ctx.fillStyle =
        "rgba(15,20,28,0.88)";

    ctx.fillRect(
        inventoryArea.x,
        inventoryArea.y,
        inventoryArea.width,
        inventoryArea.height
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.18)";

    ctx.strokeRect(
        inventoryArea.x,
        inventoryArea.y,
        inventoryArea.width,
        inventoryArea.height
    );


    towerInventory.forEach(
        (tower, index) => {

            const rect =
                getInventoryCardRect(index);

            const rarity =
                towerRarities[
                    tower.rarity
                ];

            ctx.fillStyle =
                "rgba(30,35,45,0.98)";

            ctx.fillRect(
                rect.x,
                rect.y,
                rect.width,
                rect.height
            );

            ctx.strokeStyle =
                rarity.color;

            ctx.lineWidth = 2;

            ctx.strokeRect(
                rect.x,
                rect.y,
                rect.width,
                rect.height
            );


            // 등급
            ctx.fillStyle =
                rarity.color;

            ctx.font =
                "bold 9px Arial";

            ctx.textAlign =
                "center";

            ctx.fillText(
                rarity.shortName,
                rect.x + rect.width / 2,
                rect.y + 13
            );


            // 타워 아이콘
            const cx =
                rect.x + rect.width / 2;

            const cy =
                rect.y + 34;

            ctx.fillStyle =
                tower.type === "cannon"
                    ? "#c96e4e"
                    : tower.type === "splash"
                        ? "#9369d0"
                        : "#5275df";

            ctx.fillRect(
                cx - 10,
                cy - 8,
                20,
                20
            );


            // 레벨
            ctx.fillStyle =
                "#ffffff";

            ctx.font =
                "bold 9px Arial";

            ctx.fillText(
                "Lv." + tower.level,
                cx,
                rect.y + 57
            );


            // 판매 버튼 (X)
            const sellRect =
                getSellButtonRect(index);

            const sellCx =
                sellRect.x + sellRect.width / 2;

            const sellCy =
                sellRect.y + sellRect.height / 2;

            ctx.fillStyle =
                "rgba(200,55,55,0.9)";

            ctx.beginPath();

            ctx.arc(
                sellCx,
                sellCy,
                sellRect.width / 2,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.strokeStyle =
                "rgba(255,255,255,0.9)";

            ctx.lineWidth = 1.5;

            ctx.beginPath();

            ctx.moveTo(
                sellRect.x + 4,
                sellRect.y + 4
            );

            ctx.lineTo(
                sellRect.x + sellRect.width - 4,
                sellRect.y + sellRect.height - 4
            );

            ctx.moveTo(
                sellRect.x + sellRect.width - 4,
                sellRect.y + 4
            );

            ctx.lineTo(
                sellRect.x + 4,
                sellRect.y + sellRect.height - 4
            );

            ctx.stroke();
        }
    );


    // 판매 가격 툴팁
    if (
        hoveredSellIndex >= 0 &&
        towerInventory[hoveredSellIndex]
    ) {

        const tooltipTower =
            towerInventory[hoveredSellIndex];

        const tooltipRarity =
            towerRarities[
                tooltipTower.rarity
            ];

        const cardRect =
            getInventoryCardRect(
                hoveredSellIndex
            );

        const tooltipText =
            "판매 " +
            tooltipRarity.sellPrice +
            "G";

        ctx.font =
            "bold 11px Arial";

        const textWidth =
            ctx.measureText(tooltipText).width;

        const tooltipWidth =
            textWidth + 16;

        const tooltipHeight = 22;

        const tooltipX =
            cardRect.x +
            cardRect.width / 2 -
            tooltipWidth / 2;

        const tooltipY =
            cardRect.y - tooltipHeight - 6;

        ctx.fillStyle =
            "rgba(15,18,25,0.95)";

        ctx.strokeStyle =
            "rgba(255,255,255,0.25)";

        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(
            tooltipX,
            tooltipY,
            tooltipWidth,
            tooltipHeight,
            6
        );

        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffd76b";
        ctx.textAlign = "center";

        ctx.fillText(
            tooltipText,
            tooltipX + tooltipWidth / 2,
            tooltipY + 15
        );
    }


    // 소환 버튼
    const canSummon =
        gold >= TOWER_COST &&
        towerInventory.length <
            MAX_INVENTORY;

    ctx.fillStyle =
        canSummon
            ? "#3c78d8"
            : "#555b63";

    ctx.fillRect(
        summonButton.x,
        summonButton.y,
        summonButton.width,
        summonButton.height
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.25)";

    ctx.lineWidth = 1;

    ctx.strokeRect(
        summonButton.x,
        summonButton.y,
        summonButton.width,
        summonButton.height
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        "SUMMON TOWER",
        summonButton.x +
            summonButton.width / 2,
        summonButton.y + 25
    );

    ctx.fillStyle = "#dbe6ff";
    ctx.font = "11px Arial";

    ctx.fillText(
        TOWER_COST +
        " GOLD  ·  " +
        towerInventory.length +
        "/" +
        MAX_INVENTORY,
        summonButton.x +
            summonButton.width / 2,
        summonButton.y + 44
    );


    // 드래그 중인 타워
    if (draggingTower) {

        const tower =
            draggingTower.data;

        const rarity =
            towerRarities[
                tower.rarity
            ];

        const position =
            getBuildPosition(
                dragX,
                dragY
            );

        let valid = false;

        if (position) {

            valid =
                canPlaceTower(
                    position.col,
                    position.row
                );
        }


        // 설치 칸 표시
        if (position) {

            ctx.fillStyle =
                valid
                    ? "rgba(80,220,130,0.25)"
                    : "rgba(255,70,70,0.25)";

            ctx.fillRect(
                position.col * TILE_SIZE + 2,
                position.row * TILE_SIZE + 2,
                TILE_SIZE - 4,
                TILE_SIZE - 4
            );

            ctx.strokeStyle =
                valid
                    ? "#74e39a"
                    : "#ff7777";

            ctx.lineWidth = 2;

            ctx.strokeRect(
                position.col * TILE_SIZE + 2,
                position.row * TILE_SIZE + 2,
                TILE_SIZE - 4,
                TILE_SIZE - 4
            );
        }


        // 드래그 중인 카드
        ctx.save();

        ctx.globalAlpha = 0.88;

        ctx.fillStyle =
            "rgba(30,35,45,0.98)";

        ctx.fillRect(
            dragX - 35,
            dragY - 35,
            70,
            70
        );

        ctx.strokeStyle =
            rarity.color;

        ctx.lineWidth = 3;

        ctx.strokeRect(
            dragX - 35,
            dragY - 35,
            70,
            70
        );

        ctx.fillStyle =
            rarity.color;

        ctx.font =
            "bold 9px Arial";

        ctx.textAlign =
            "center";

        ctx.fillText(
            rarity.name,
            dragX,
            dragY - 18
        );

        ctx.fillStyle =
            tower.type === "cannon"
                ? "#c96e4e"
                : tower.type === "splash"
                    ? "#9369d0"
                    : "#5275df";

        ctx.fillRect(
            dragX - 13,
            dragY - 7,
            26,
            26
        );

        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "bold 10px Arial";

        ctx.fillText(
            towerTypes[
                tower.type
            ].name,
            dragX,
            dragY + 31
        );

        ctx.restore();
    }
}


// =====================================================
// WAVE STATUS
// =====================================================

// =====================================================
// 속도 조절 / 일시정지 버튼
// =====================================================

function drawControlBar() {

    ctx.fillStyle =
        "rgba(15,20,28,0.72)";

    ctx.fillRect(
        CONTROL_BAR_X,
        CONTROL_BAR_Y,
        CONTROL_BAR_WIDTH,
        CONTROL_BAR_HEIGHT
    );


    // 속도 버튼 (0x / 1x / 2x)
    SPEED_VALUES.forEach((speedValue) => {

        const rect =
            getSpeedButtonRect(speedValue);

        const isActive =
            gameSpeed === speedValue;

        ctx.fillStyle =
            isActive
                ? "#3f7cff"
                : "rgba(255,255,255,0.08)";

        ctx.fillRect(
            rect.x,
            rect.y,
            rect.width,
            rect.height
        );

        ctx.strokeStyle =
            "rgba(255,255,255,0.25)";

        ctx.lineWidth = 1;

        ctx.strokeRect(
            rect.x,
            rect.y,
            rect.width,
            rect.height
        );

        ctx.fillStyle =
            isActive ? "#ffffff" : "#aab2bf";

        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";

        ctx.fillText(
            speedValue + "x",
            rect.x + rect.width / 2,
            rect.y + rect.height / 2 + 4
        );
    });


    // 일시정지 버튼
    const pauseRect =
        getPauseButtonRect();

    ctx.fillStyle =
        "rgba(255,255,255,0.08)";

    ctx.fillRect(
        pauseRect.x,
        pauseRect.y,
        pauseRect.width,
        pauseRect.height
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.25)";

    ctx.strokeRect(
        pauseRect.x,
        pauseRect.y,
        pauseRect.width,
        pauseRect.height
    );

    // 일시정지 아이콘 (막대 2개)
    ctx.fillStyle = "#ffffff";

    const barWidth = 4;
    const barHeight = 12;
    const barGap = 4;

    const iconCenterX =
        pauseRect.x + 16;

    const iconY =
        pauseRect.y +
        pauseRect.height / 2 -
        barHeight / 2;

    ctx.fillRect(
        iconCenterX - barGap / 2 - barWidth,
        iconY,
        barWidth,
        barHeight
    );

    ctx.fillRect(
        iconCenterX + barGap / 2,
        iconY,
        barWidth,
        barHeight
    );

    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";

    ctx.fillText(
        "PAUSE",
        pauseRect.x + 28,
        pauseRect.y + pauseRect.height / 2 + 4
    );
}


// =====================================================
// 일시정지 오버레이
// =====================================================

function drawPauseOverlay() {

    ctx.fillStyle =
        "rgba(10,13,19,0.85)";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const centerX = canvas.width / 2;

    ctx.textAlign = "center";

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px Arial";

    ctx.fillText(
        "PAUSED",
        centerX,
        190
    );

    ctx.fillStyle = "#9fc9ff";
    ctx.font = "15px Arial";

    ctx.fillText(
        "게임이 일시정지되었습니다.",
        centerX,
        222
    );

    const buttons =
        getPauseModalButtonRects();

    drawMenuButton(
        buttons.resume.x,
        buttons.resume.y,
        buttons.resume.width,
        buttons.resume.height,
        "게임 재개"
    );

    drawMenuButton(
        buttons.restart.x,
        buttons.restart.y,
        buttons.restart.width,
        buttons.restart.height,
        "재시작"
    );

    drawMenuButton(
        buttons.menu.x,
        buttons.menu.y,
        buttons.menu.width,
        buttons.menu.height,
        "메뉴 화면"
    );
}


function drawWaveStatus() {

    if (gameState !== "playing") {
        return;
    }

    const total =
        WAVE_ENEMIES[wave - 1];

    ctx.fillStyle =
        "rgba(15,20,28,0.72)";

    ctx.fillRect(
        15,
        15,
        190,
        45
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";

    ctx.fillText(
        "WAVE " + wave + " / " + TOTAL_WAVES,
        28,
        35
    );

    ctx.fillStyle = "#b8c0cc";
    ctx.font = "11px Arial";

    ctx.fillText(
        "Enemies: " +
        Math.min(
            waveEnemiesSpawned,
            total
        ) +
        " / " +
        total,
        28,
        51
    );
}


// =====================================================
// UPGRADE PANEL
// =====================================================

function drawUpgradePanel() {

    if (!selectedTower) {

        return;
    }


    const panelWidth = 270;
    const panelHeight = 200;


    const panelX =
        canvas.width -
        panelWidth -
        15;


    const panelY = 15;


    // ---------------------------------------------
    // 패널
    // ---------------------------------------------

    ctx.fillStyle =
        "rgba(25,30,38,0.96)";


    ctx.fillRect(
        panelX,
        panelY,
        panelWidth,
        panelHeight
    );


    ctx.strokeStyle =
        "rgba(255,255,255,0.2)";

    ctx.lineWidth = 1;


    ctx.strokeRect(
        panelX,
        panelY,
        panelWidth,
        panelHeight
    );


    // ---------------------------------------------
    // 제목
    // ---------------------------------------------

    ctx.fillStyle =
        "#ffffff";

    ctx.textAlign =
        "left";


    const selectedType =
        towerTypes[selectedTower.type || "basic"];

    const selectedRarity =
        towerRarities[
            selectedTower.rarity || "normal"
        ];

    const titleText =
        selectedRarity.name +
        " " +
        selectedType.name +
        " TOWER";

    // 이름이 길어도 패널 밖으로 삐져나오지 않도록
    // 폭에 맞춰 글자 크기를 자동으로 줄입니다.
    const maxTitleWidth =
        panelWidth - 15 - 40;

    let titleFontSize = 17;

    ctx.font =
        "bold " + titleFontSize + "px Arial";

    while (
        ctx.measureText(titleText).width >
            maxTitleWidth &&
        titleFontSize > 10
    ) {

        titleFontSize -= 1;

        ctx.font =
            "bold " +
            titleFontSize +
            "px Arial";
    }

    ctx.fillStyle =
        selectedRarity.color;

    ctx.fillText(
        titleText,
        panelX + 15,
        panelY + 25
    );


    // ---------------------------------------------
    // 닫기 버튼
    // ---------------------------------------------

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(
        panelX + panelWidth - 35,
        panelY + 10,
        25,
        25
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        "×",
        panelX + panelWidth - 22.5,
        panelY + 28
    );


    // ---------------------------------------------
    // 구분선
    // ---------------------------------------------

    ctx.strokeStyle =
        "rgba(255,255,255,0.12)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(
        panelX + 15,
        panelY + 36
    );

    ctx.lineTo(
        panelX + panelWidth - 15,
        panelY + 36
    );

    ctx.stroke();


    // ---------------------------------------------
    // 레벨
    // ---------------------------------------------

    ctx.fillStyle =
        "#8ed8ff";

    ctx.font =
        "bold 13px Arial";

    ctx.textAlign =
        "left";


    ctx.fillText(
        "LEVEL " +
        selectedTower.level,
        panelX + 15,
        panelY + 55
    );


    // ---------------------------------------------
    // 스탯 (라벨 좌측 / 값 우측 정렬)
    // ---------------------------------------------

    const statRows = [
        {
            label: "DAMAGE",
            value: Math.round(selectedTower.damage)
        },
        {
            label: "RANGE",
            value: Math.round(selectedTower.range)
        },
        {
            label: "ATTACK SPEED",
            value: Math.round(selectedTower.fireRate)
        }
    ];

    let statY = panelY + 78;

    statRows.forEach((row) => {

        ctx.textAlign = "left";
        ctx.fillStyle = "#8a94a3";
        ctx.font = "11px Arial";

        ctx.fillText(
            row.label,
            panelX + 18,
            statY
        );

        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Arial";

        ctx.fillText(
            String(row.value),
            panelX + panelWidth - 18,
            statY
        );

        statY += 22;
    });

    ctx.textAlign = "left";


    // ---------------------------------------------
    // 업그레이드 버튼
    // ---------------------------------------------

    const buttonX =
        panelX + 15;

    const buttonY =
        panelY + 148;

    const buttonWidth =
        panelWidth - 30;

    const buttonHeight = 38;


    let buttonColor;


    if (
        selectedTower.level >= 3
    ) {

        buttonColor =
            "#555b63";

    } else {

        const cost =
            towerLevels[
                selectedTower.level
            ].upgradeCost;


        buttonColor =
            gold >= cost
                ? "#3c9b68"
                : "#754747";
    }


    ctx.fillStyle =
        buttonColor;


    ctx.fillRect(
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight
    );


    ctx.strokeStyle =
        "rgba(255,255,255,0.25)";


    ctx.strokeRect(
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight
    );


    ctx.textAlign =
        "center";


    if (
        selectedTower.level >= 3
    ) {

        ctx.fillStyle =
            "#dddddd";

        ctx.font =
            "bold 13px Arial";


        ctx.fillText(
            "MAX LEVEL",
            buttonX +
            buttonWidth / 2,
            buttonY + 25
        );

    } else {

        const cost =
            towerLevels[
                selectedTower.level
            ].upgradeCost;


        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "bold 13px Arial";


        ctx.fillText(
            "UPGRADE  •  " +
            cost +
            " GOLD",
            buttonX +
            buttonWidth / 2,
            buttonY + 25
        );
    }
}


// =====================================================
// ENEMY DRAW
// =====================================================

function drawEnemies() {

    enemies.forEach(enemy => {


        // 그림자

        ctx.fillStyle =
            "rgba(0,0,0,0.25)";


        ctx.beginPath();

        ctx.ellipse(
            enemy.x,
            enemy.y + 14,
            15,
            6,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // 몬스터

        ctx.fillStyle =
            enemy.type === "boss"
                ? "#7a1fa2"
                : enemy.type === "fast"
                    ? "#ff8a3d"
                    : enemy.type === "cluster"
                        ? "#4cc9a6"
                        : "#d93636";


        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            15,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // 눈

        ctx.fillStyle =
            "#ffffff";


        ctx.beginPath();

        ctx.arc(
            enemy.x - 5,
            enemy.y - 3,
            3,
            0,
            Math.PI * 2
        );

        ctx.arc(
            enemy.x + 5,
            enemy.y - 3,
            3,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // HP 배경

        ctx.fillStyle =
            "#222222";


        ctx.fillRect(
            enemy.x - 18,
            enemy.y - 27,
            36,
            5
        );


        // HP

        ctx.fillStyle =
            "#55d66a";


        ctx.fillRect(
            enemy.x - 18,
            enemy.y - 27,
            36 *
            Math.max(
                0,
                enemy.hp /
                enemy.maxHP
            ),
            5
        );
    });
}


// =====================================================
// BULLET DRAW
// =====================================================

function drawBullets() {

    bullets.forEach(bullet => {


        // 총알 궤적

        ctx.strokeStyle =
            "rgba(255,220,80,0.4)";

        ctx.lineWidth = 3;


        ctx.beginPath();


        ctx.moveTo(
            bullet.x,
            bullet.y
        );


        ctx.lineTo(
            bullet.x -
            (
                bullet.target.x -
                bullet.x
            ) * 0.35,

            bullet.y -
            (
                bullet.target.y -
                bullet.y
            ) * 0.35
        );


        ctx.stroke();


        // 총알

        ctx.fillStyle =
            bullet.type === "cannon"
                ? "#ff9f43"
                : bullet.type === "splash"
                    ? "#c792ff"
                    : "#ffe066";


        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            5,
            0,
            Math.PI * 2
        );

        ctx.fill();


        // 총알 빛

        ctx.fillStyle =
            "rgba(255,235,120,0.3)";


        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            10,
            0,
            Math.PI * 2
        );

        ctx.fill();
    });
}


// =====================================================
// EFFECT DRAW
// =====================================================

function drawEffects() {

    effects.forEach(effect => {

        ctx.globalAlpha =
            effect.alpha;


        ctx.strokeStyle =
            effect.color;


        ctx.lineWidth = 3;


        ctx.beginPath();

        ctx.arc(
            effect.x,
            effect.y,
            effect.radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();


        ctx.globalAlpha = 1;
    });
}


// =====================================================
// BASE
// =====================================================

function drawBase() {

    const base =
        pathTiles[
            pathTiles.length - 1
        ];


    const center =
        tileCenter(
            base.col,
            base.row
        );


    // 기지 그림자

    ctx.fillStyle =
        "rgba(0,0,0,0.2)";


    ctx.fillRect(
        center.x - 26,
        center.y + 27,
        52,
        6
    );


    // 기지 본체

    ctx.fillStyle =
        "#d63c3c";


    ctx.fillRect(
        center.x - 24,
        center.y - 24,
        48,
        48
    );


    // 지붕

    ctx.fillStyle =
        "#8e2020";


    ctx.beginPath();


    ctx.moveTo(
        center.x - 29,
        center.y - 24
    );


    ctx.lineTo(
        center.x,
        center.y - 42
    );


    ctx.lineTo(
        center.x + 29,
        center.y - 24
    );


    ctx.closePath();

    ctx.fill();


    // BASE

    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "bold 10px Arial";

    ctx.textAlign =
        "center";


    ctx.fillText(
        "BASE",
        center.x,
        center.y + 4
    );


    // HP 배경

    ctx.fillStyle =
        "#222222";


    ctx.fillRect(
        center.x - 25,
        center.y + 31,
        50,
        5
    );


    // HP

    ctx.fillStyle =
        "#4caf50";


    ctx.fillRect(
        center.x - 25,
        center.y + 31,
        50 *
        Math.max(
            0,
            baseHP / 100
        ),
        5
    );
}


// =====================================================
// UI UPDATE
// =====================================================

function updateUI() {

    hpText.textContent =
        Math.max(
            0,
            baseHP
        );


    goldText.textContent =
        gold;


    waveText.textContent =
        wave +
        " / " +
        TOTAL_WAVES;
}


// =====================================================
// GAME OVER
// =====================================================

function gameClear() {

    gameRunning = false;
    waveActive = false;

    clearAllTimers();

    gameState = "ended";
    gameResult = "clear";
    saveLeaderboardRecord();
    selectedTower = null;

    draw();
}


function gameOver() {

    gameRunning = false;
    waveActive = false;

    clearAllTimers();

    gameState = "ended";
    gameResult = "gameover";
    saveLeaderboardRecord();
    selectedTower = null;

    draw();
}


// =====================================================
// MAIN MENU
// =====================================================

function drawLeaderboardPanel(x, y, width, height) {

    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(x, y, width, height);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Arial";
    ctx.fillText("GOLD 사용량 TOP 10", x + 14, y + 24);

    ctx.fillStyle = "#7f8b9a";
    ctx.font = "10px Arial";
    ctx.fillText("적게 사용한 순", x + width - 92, y + 24);

    const leaderboard = getLeaderboard();

    for (let i = 0; i < 10; i++) {
        const rowY = y + 45 + i * 16;
        const record = leaderboard[i];

        if (!record) {
            ctx.fillStyle = "#586270";
            ctx.font = "10px Arial";
            ctx.fillText(`${i + 1}. ---`, x + 14, rowY);
            continue;
        }

        ctx.fillStyle = i === 0 ? "#ffd34d" :
                        i === 1 ? "#d8dce3" :
                        i === 2 ? "#d09a68" : "#aeb8c6";
        ctx.font = i < 3 ? "bold 10px Arial" : "10px Arial";
        ctx.fillText(`${i + 1}.`, x + 14, rowY);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${record.goldSpent} GOLD`, x + 38, rowY);

        ctx.fillStyle = record.result === "clear" ? "#72e08a" : "#ff7777";
        ctx.fillText(record.result === "clear" ? "CLEAR" : "OVER", x + 130, rowY);
    }

    ctx.textAlign = "center";
}


function drawMainMenu() {

    ctx.fillStyle = "rgba(15,20,28,0.82)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const centerX = canvas.width / 2;

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";
    ctx.fillText("TOWER DEFENSE",centerX,150);

    ctx.fillStyle = "#9fc9ff";
    ctx.font = "16px Arial";
    ctx.fillText(
        "Defend your base from incoming monsters",
        centerX,180
    );

    drawMenuButton(centerX-120,215,240,50,"GAME START");
    drawMenuButton(centerX-120,280,240,50,"HOW TO PLAY");
    drawMenuButton(centerX-120,345,240,50,"STATISTICS");

    if(showStats){
        drawStatisticsPopup();
    }
}


function getGoldRecords(){
    try{
        const raw=localStorage.getItem("towerDefenseGoldRecords");
        const data=raw?JSON.parse(raw):[];
        return Array.isArray(data)
            ? data.sort((a,b)=>a.gold-b.gold).slice(0,10)
            : [];
    }catch(e){
        return [];
    }
}

function drawStatisticsPopup() {

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const width = 500;
    const height = 560;
    const x = (canvas.width-width)/2;
    const y = (canvas.height-height)/2;

    ctx.fillStyle = "rgba(25,30,38,0.98)";
    ctx.fillRect(x,y,width,height);

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(x,y,width,height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 25px Arial";
    ctx.fillText("GOLD SPENDING TOP 10",canvas.width/2,y+40);

    ctx.textAlign="left";
    ctx.fillStyle="#ffffff";
    ctx.font="bold 15px Arial";
    ctx.fillText("THIS GAME - TOWER RARITY",x+35,y+75);

    const currentLabels=[
        ["NORMAL",currentRarityCounts.normal],
        ["RARE",currentRarityCounts.rare],
        ["UNIQUE",currentRarityCounts.unique],
        ["LEGENDARY",currentRarityCounts.legendary],
        ["SUPER LEGEND",currentRarityCounts.super]
    ];

    currentLabels.forEach((item,i)=>{
        const col=i%2, row=Math.floor(i/2);
        const yy=y+103+row*24;
        ctx.fillStyle="#dce3ec";
        ctx.font="13px Arial";
        ctx.fillText(`${item[0]}: ${item[1]}개`,x+35+col*215,yy);
    });

    ctx.textAlign="center";
    ctx.fillStyle="#ffffff";
    ctx.font="bold 15px Arial";
    ctx.fillText("GOLD SPENDING TOP 10",canvas.width/2,y+190);

    const records = getGoldRecords();

    if(records.length===0){
        ctx.fillStyle="#aaaaaa";
        ctx.font="15px Arial";
        ctx.fillText("아직 기록이 없습니다.",canvas.width/2,y+105);
    }else{
        ctx.textAlign="left";
        ctx.font="bold 14px Arial";
        records.forEach((record,index)=>{
            const yy=y+215+index*25;
            ctx.fillStyle=index===0 ? "#ffd34d" : "#ffffff";
            ctx.fillText(`${index+1}.  ${record.gold} GOLD`,x+45,yy);
            ctx.fillStyle="#8e9aaa";
            ctx.font="12px Arial";
            ctx.fillText(record.result==="clear" ? "CLEAR" : "GAME OVER",x+340,yy);
            ctx.font="bold 14px Arial";
        });
    }

    drawMenuButton(canvas.width/2-90,y+height-52,180,42,"BACK");
}

function drawHowToPlay() {

    ctx.fillStyle = "rgba(15,20,28,0.92)";
    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const centerX = canvas.width / 2;


    ctx.textAlign = "center";

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px Arial";

    ctx.fillText(
        "HOW TO PLAY",
        centerX,
        105
    );


    ctx.textAlign = "left";
    ctx.fillStyle = "#dddddd";
    ctx.font = "16px Arial";


    const lines = [
        "• SUMMON TOWER를 눌러 랜덤 타워를 소환하세요.",
        "• 노말 / 레어 / 유니크 / 전설 / 초전설 등급이 있습니다.",
        "• 하단의 타워를 마우스로 드래그해 원하는 칸에 배치하세요.",
        "• 타워는 사거리 안에서 기지에 가장 가까운 몬스터를 우선 공격합니다.",
        "• 타워를 클릭하면 사거리와 업그레이드 정보가 표시됩니다.",
        "• 골드를 사용해 타워를 최대 3단계까지 업그레이드하세요.",
        "• 기지 HP가 0이 되면 게임 오버입니다.",
        "• 5웨이브의 마지막 보스를 처치하면 게임 클리어입니다."
    ];


    lines.forEach((line, index) => {

        ctx.fillText(
            line,
            centerX - 300,
            165 + index * 34
        );
    });


    drawMenuButton(
        centerX - 100,
        430,
        200,
        50,
        "BACK"
    );
}


// =====================================================
// GAME END POPUP
// =====================================================

function drawGameEndPopup() {

    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const width = 500;
    const height = 330;
    const x = (canvas.width-width)/2;
    const y = (canvas.height-height)/2;

    ctx.fillStyle = "rgba(25,30,38,0.98)";
    ctx.fillRect(x,y,width,height);

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(x,y,width,height);

    ctx.textAlign="center";

    ctx.fillStyle=gameResult==="clear" ? "#72e08a" : "#ff6666";
    ctx.font="bold 32px Arial";
    ctx.fillText(
        gameResult==="clear" ? "GAME CLEAR!" : "GAME OVER",
        canvas.width/2,y+48
    );

    ctx.fillStyle="#dddddd";
    ctx.font="15px Arial";
    ctx.fillText(
        gameResult==="clear"
        ? "기지를 성공적으로 지켰습니다."
        : "기지가 파괴되었습니다.",
        canvas.width/2,y+78
    );

    ctx.textAlign="left";
    ctx.fillStyle="#ffffff";
    ctx.font="bold 14px Arial";
    ctx.fillText(`총 사용 골드: ${totalGoldSpent} GOLD`,x+45,y+115);

    const labels=[
        ["NORMAL",normalCount],
        ["RARE",rareCount],
        ["UNIQUE",uniqueCount],
        ["LEGENDARY",legendaryCount],
        ["SUPER LEGEND",superLegendCount]
    ];

    labels.forEach((item,i)=>{
        ctx.fillText(`${item[0]}: ${item[1]}개`,x+45+(i%2)*205,y+145+Math.floor(i/2)*25);
    });

    drawMenuButton(x+35,y+250,130,45,"MAIN MENU");
    drawMenuButton(x+185,y+250,130,45,"RESTART");
    drawMenuButton(x+335,y+250,130,45,"STATISTICS");
}


function drawMenuButton(
    x,
    y,
    width,
    height,
    text
) {

    ctx.fillStyle =
        "rgba(70,110,190,0.95)";

    ctx.fillRect(
        x,
        y,
        width,
        height
    );


    ctx.strokeStyle =
        "rgba(255,255,255,0.3)";

    ctx.lineWidth = 1;

    ctx.strokeRect(
        x,
        y,
        width,
        height
    );


    ctx.fillStyle = "#ffffff";

    ctx.font =
        "bold 15px Arial";

    ctx.textAlign = "center";


    ctx.fillText(
        text,
        x + width / 2,
        y + height / 2 + 5
    );
}


// =====================================================
// GAME UPDATE (per frame)
// =====================================================

function updateGame() {

    updateEnemies();
    updateTowers();
    updateBullets();
    updateEffects();
    checkWaveClear();
}


// =====================================================
// GAME LOOP
// =====================================================
//
// requestAnimationFrame은 탭이 화면에서 벗어나면(백그라운드)
// 브라우저가 아예 멈춰버립니다. 화면을 벗어나도 게임이 계속
// 진행되도록, 실제 경과 시간(Date.now())을 기준으로 얼마나
// 많은 업데이트를 처리해야 하는지 계산하는 방식으로 바꿨습니다.
// 탭이 다시 활성화되면 그동안 흐른 시간만큼 즉시 따라잡습니다.

const TICK_MS = 1000 / 60;

// 한 번에 몰아서 따라잡는 최대 tick 수.
// 아주 오랫동안 화면을 벗어나 있었더라도 브라우저가
// 한 번에 얼어붙지 않도록, 남은 시간은 다음 루프에서
// 이어서 계속 따라잡습니다.
const MAX_TICKS_PER_LOOP = 120;

let lastTickTime = Date.now();


function gameLoop() {

    const now = Date.now();
    const realElapsed = now - lastTickTime;

    if (
        gameRunning &&
        !gamePaused &&
        gameSpeed > 0
    ) {

        const virtualElapsed =
            realElapsed * gameSpeed;

        let ticksToRun =
            Math.floor(
                virtualElapsed / TICK_MS
            );

        if (ticksToRun > MAX_TICKS_PER_LOOP) {
            ticksToRun = MAX_TICKS_PER_LOOP;
        }

        for (
            let i = 0;
            i < ticksToRun;
            i++
        ) {

            updateGame();
        }

        // 실제로 처리한 시간만큼만 진행시키고,
        // 남은 오차는 다음 루프에서 이어서 처리합니다.
        lastTickTime =
            now -
            (
                virtualElapsed -
                ticksToRun * TICK_MS
            ) / gameSpeed;

    } else {

        // 정지 상태에서는 따라잡을 시간이
        // 쌓이지 않도록 매번 초기화합니다.
        lastTickTime = now;
    }

    draw();
}


setInterval(gameLoop, TICK_MS);



// =====================================================
// INITIALIZE
// =====================================================

updateUI();

gameState = "menu";
draw();

// 초기 화면 표시

draw();
