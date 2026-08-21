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

const TOTAL_WAVES = 5;
const WAVE_ENEMIES = [15, 21, 27, 36, 45];

let baseHP = 100;
let gold = 100;
let wave = 1;


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
        color: "#c9c9c9"
    },

    rare: {
        name: "RARE",
        shortName: "R",
        chance: 25.0,
        multiplier: 1.5,
        color: "#4da3ff"
    },

    unique: {
        name: "UNIQUE",
        shortName: "U",
        chance: 13.0,
        multiplier: 2.5,
        color: "#b56cff"
    },

    legendary: {
        name: "LEGENDARY",
        shortName: "L",
        chance: 2.0,
        multiplier: 5.0,
        color: "#ffd34d"
    },

    superLegendary: {
        name: "SUPER LEGEND",
        shortName: "SL",
        chance: 0.1,
        multiplier: 20.0,
        color: "#ff4d7d"
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

    const typeKey =
        rollTowerType();

    const rarityKey =
        rollTowerRarity();

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
// START GAME
// =====================================================

// 기존 HTML 시작 버튼은 사용하지 않고
// Canvas 중앙 메뉴를 사용합니다.
if (startButton) {
    startButton.style.display = "none";
}


function startGame() {

    gameRunning = true;
    gameState = "playing";
    gameResult = null;
    enemiesDefeated = 0;
    wave = 1;
    waveEnemiesSpawned = 0;
    waveEnemiesDefeated = 0;
    waveActive = false;
    waveBossDefeated = false;

    if (spawnTimer) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
    }

    if (waveClearTimer) {
        clearTimeout(waveClearTimer);
        waveClearTimer = null;
    }

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

    requestAnimationFrame(gameLoop);
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

        draw();

        return;
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

        // 초기 화면으로
        if (
            x >= centerX - 145 &&
            x <= centerX - 10 &&
            y >= 330 &&
            y <= 380
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
            y >= 330 &&
            y <= 380
        ) {
            startGame();
            return;
        }

        return;
    }


    if (!gameRunning) return;

    // =================================================
    // 1. 업그레이드 패널 닫기 / 버튼 확인
    // =================================================

    if (selectedTower) {

        const panelWidth = 240;

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
            panelY + 145;

        const buttonWidth = 210;
        const buttonHeight = 40;


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

    tower.fireRate =
        towerLevels[nextLevel].fireRate *
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

        spawnTimer =
            setTimeout(
                spawnEnemy,
                spawnDelay
            );

    } else {

        spawnTimer = null;

        if (wave === TOTAL_WAVES) {
            spawnTimer = setTimeout(
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


        waveClearTimer =
            setTimeout(() => {

                if (!gameRunning) {
                    return;
                }

                wave++;
                startWave();

            }, 1800);
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

            baseHP -= 10;

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
        }
    );


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


    const panelWidth = 240;
    const panelHeight = 210;


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

    ctx.font =
        "bold 17px Arial";

    ctx.textAlign =
        "left";


    const selectedType =
        towerTypes[selectedTower.type || "basic"];

    const selectedRarity =
        towerRarities[
            selectedTower.rarity || "normal"
        ];

    ctx.fillStyle =
        selectedRarity.color;

    ctx.fillText(
        selectedRarity.name +
        " " +
        selectedType.name +
        " TOWER",
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
    // 레벨
    // ---------------------------------------------

    ctx.fillStyle =
        "#8ed8ff";

    ctx.font =
        "bold 14px Arial";


    ctx.fillText(
        "LEVEL " +
        selectedTower.level,
        panelX + 15,
        panelY + 48
    );


    // ---------------------------------------------
    // 스탯
    // ---------------------------------------------

    ctx.fillStyle =
        "#dddddd";

    ctx.font =
        "13px Arial";


    ctx.fillText(
        "Damage: " +
        selectedTower.damage,
        panelX + 15,
        panelY + 73
    );


    ctx.fillText(
        "Range: " +
        selectedTower.range,
        panelX + 125,
        panelY + 73
    );


    ctx.fillText(
        "Attack Speed: " +
        selectedTower.fireRate,
        panelX + 15,
        panelY + 95
    );


    // ---------------------------------------------
    // 안내 문구
    // ---------------------------------------------

    ctx.fillStyle =
        "#999999";

    ctx.font =
        "11px Arial";


    ctx.fillText(
        "Upgrade this tower",
        panelX + 15,
        panelY + 125
    );


    // ---------------------------------------------
    // 업그레이드 버튼
    // ---------------------------------------------

    const buttonX =
        panelX + 15;

    const buttonY =
        panelY + 145;

    const buttonWidth = 210;
    const buttonHeight = 40;


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

    if (spawnTimer) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
    }

    if (waveClearTimer) {
        clearTimeout(waveClearTimer);
        waveClearTimer = null;
    }
    gameState = "ended";
    gameResult = "clear";
    selectedTower = null;

    draw();
}


function gameOver() {

    gameRunning = false;
    waveActive = false;

    if (spawnTimer) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
    }

    if (waveClearTimer) {
        clearTimeout(waveClearTimer);
        waveClearTimer = null;
    }
    gameState = "ended";
    gameResult = "gameover";
    selectedTower = null;

    draw();
}


// =====================================================
// MAIN MENU
// =====================================================

function drawMainMenu() {

    ctx.fillStyle = "rgba(15,20,28,0.82)";
    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const centerX = canvas.width / 2;


    ctx.textAlign = "center";

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";

    ctx.fillText(
        "TOWER DEFENSE",
        centerX,
        190
    );


    ctx.fillStyle = "#9fc9ff";
    ctx.font = "16px Arial";

    ctx.fillText(
        "Defend your base from incoming monsters",
        centerX,
        220
    );


    drawMenuButton(
        centerX - 120,
        255,
        240,
        50,
        "GAME START"
    );


    drawMenuButton(
        centerX - 120,
        325,
        240,
        50,
        "HOW TO PLAY"
    );
}


// =====================================================
// HOW TO PLAY
// =====================================================

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
    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const width = 460;
    const height = 245;

    const x =
        (canvas.width - width) / 2;

    const y =
        (canvas.height - height) / 2;


    // 팝업
    ctx.fillStyle =
        "rgba(25,30,38,0.98)";

    ctx.fillRect(
        x,
        y,
        width,
        height
    );


    ctx.strokeStyle =
        "rgba(255,255,255,0.25)";

    ctx.lineWidth = 2;

    ctx.strokeRect(
        x,
        y,
        width,
        height
    );


    ctx.textAlign = "center";


    if (gameResult === "clear") {

        ctx.fillStyle = "#72e08a";
        ctx.font = "bold 36px Arial";

        ctx.fillText(
            "GAME CLEAR!",
            canvas.width / 2,
            y + 65
        );


        ctx.fillStyle = "#dddddd";
        ctx.font = "16px Arial";

        ctx.fillText(
            "기지를 성공적으로 지켰습니다.",
            canvas.width / 2,
            y + 105
        );

    } else {

        ctx.fillStyle = "#ff6666";
        ctx.font = "bold 36px Arial";

        ctx.fillText(
            "GAME OVER",
            canvas.width / 2,
            y + 65
        );


        ctx.fillStyle = "#dddddd";
        ctx.font = "16px Arial";

        ctx.fillText(
            "기지가 파괴되었습니다.",
            canvas.width / 2,
            y + 105
        );
    }


    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px Arial";

    ctx.fillText(
        "어디로 이동할지 선택하세요.",
        canvas.width / 2,
        y + 140
    );


    drawMenuButton(
        canvas.width / 2 - 145,
        y + 160,
        135,
        50,
        "MAIN MENU"
    );


    drawMenuButton(
        canvas.width / 2 + 10,
        y + 160,
        135,
        50,
        "RESTART"
    );
}


// =====================================================
// MENU BUTTON
// =====================================================

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
// GAME LOOP
// =====================================================

function gameLoop() {

    if (gameRunning) {
        updateGame();
    }

    draw();

    requestAnimationFrame(gameLoop);
}



// =====================================================
// INITIALIZE
// =====================================================

updateUI();

gameState = "menu";
draw();

// 초기 화면 표시

draw();
