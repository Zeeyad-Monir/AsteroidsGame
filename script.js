document.addEventListener('DOMContentLoaded', function() {
  // Game constants
  const FPS = 60;
  const SHIP_SIZE = 20;
  const SHIP_THRUST = 0.20;
  const FRICTION = 0.98;
  const TURN_SPEED = 0.07;
  const BULLET_SPEED = 8;
  const BULLET_LIFE = 0.7; // seconds
  const MAX_BULLETS = 10;
  const ASTEROID_SPEED_MULT = 1.0;
  const ASTEROID_POINTS_LARGE = 20;
  const ASTEROID_POINTS_MEDIUM = 50;
  const ASTEROID_POINTS_SMALL = 100;
  const INVULNERABLE_TIME = 3; // seconds
  const ASTEROID_VERT = 10; // average number of vertices on asteroid
  const ASTEROID_JAG = 0.4; // jaggedness of asteroid (0 = none, 1 = lots)
  const ASTEROID_SIZE_LARGE = 80;
  const ASTEROID_SIZE_MEDIUM = 40;
  const ASTEROID_SIZE_SMALL = 20;
  const SHOW_CENTER_DOT = false; // Debugging feature to show center of ship & asteroids

  // Game variables
  let canvas, ctx;
  let ship, asteroids = [], bullets = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let gameOver = false;
  let paused = false;
  let gameStarted = false;

  // High score variables
  let highScore = localStorage.getItem("asteroids-high-score") || 0;

  // Leaderboard: We'll store an array of { name, score } objects in localStorage
  // If none exists yet, we'll store an empty array
  let storedLeaderboard = localStorage.getItem("asteroids-leaderboard");
  let leaderboard = storedLeaderboard ? JSON.parse(storedLeaderboard) : [];

  // Key handlers
  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false
  };

  // DOM elements
  const scoreDisplay = document.getElementById("score-display");
  const livesDisplay = document.getElementById("lives-display");
  const levelDisplay = document.getElementById("level-display");
  const gameOverScreen = document.getElementById("game-over");
  const finalScoreEl = document.getElementById("final-score");
  const startScreen = document.getElementById("start-screen");
  const startButton = document.getElementById("start-button");
  const restartButton = document.getElementById("restart-button");
  const pauseMenu = document.getElementById("pause-menu");
  const resumeButton = document.getElementById("resume-button");
  const quitButton = document.getElementById("quit-button");

  // NEW: Leaderboard/score submission elements
  const scoreSubmitSection = document.getElementById("score-submit-section");
  const usernameInput = document.getElementById("username-input");
  const submitScoreButton = document.getElementById("submit-score-button");
  const leaderboardSection = document.getElementById("leaderboard-section");
  const leaderboardList = document.getElementById("leaderboard-list");

  // Set up the game canvas
  function setupCanvas() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");

    // Set canvas size to 800x600 or the window size if smaller
    canvas.width = Math.min(800, window.innerWidth - 20);
    canvas.height = Math.min(600, window.innerHeight - 20);
  }

  function resizeCanvas() {
    canvas.width = Math.min(800, window.innerWidth - 20);
    canvas.height = Math.min(600, window.innerHeight - 20);
  }

  // SHIP CLASS
  class Ship {
    constructor() {
      this.x = canvas.width / 2;
      this.y = canvas.height / 2;
      this.radius = SHIP_SIZE / 2;
      this.angle = Math.PI * 1.5; // point up
      this.rotation = 0;
      this.thrusting = false;
      this.thrust = {
        x: 0,
        y: 0
      };
      this.exploding = false;
      this.explodeTime = 0;
      this.invulnerable = true;
      this.invulnerableTime = INVULNERABLE_TIME * FPS; // frames of invulnerability
      this.blinkTime = Math.ceil(0.1 * FPS); // frames between blinks
      this.blinkCount = Math.ceil(this.invulnerableTime / this.blinkTime);
      this.canShoot = true;
      this.shootTimer = 0;
    }

    update() {
      // Invulnerability countdown
      if (this.invulnerable) {
        this.blinkCount--;
        if (this.blinkCount <= 0) {
          this.invulnerable = false;
        }
      }

      // Shooting cooldown
      if (!this.canShoot) {
        this.shootTimer--;
        if (this.shootTimer <= 0) {
          this.canShoot = true;
        }
      }

      // Handle rotation
      if (keys.left) {
        this.rotation = -TURN_SPEED;
      } else if (keys.right) {
        this.rotation = TURN_SPEED;
      } else {
        this.rotation = 0;
      }

      this.angle += this.rotation;

      // Handle thrust
      this.thrusting = keys.up;

      if (this.thrusting) {
        this.thrust.x += SHIP_THRUST * Math.cos(this.angle);
        this.thrust.y -= SHIP_THRUST * Math.sin(this.angle);
      } else {
        // Apply friction
        this.thrust.x *= FRICTION;
        this.thrust.y *= FRICTION;
      }

      // Move ship
      this.x += this.thrust.x;
      this.y += this.thrust.y;

      // Screen wrap
      if (this.x < 0 - this.radius) {
        this.x = canvas.width + this.radius;
      } else if (this.x > canvas.width + this.radius) {
        this.x = 0 - this.radius;
      }
      if (this.y < 0 - this.radius) {
        this.y = canvas.height + this.radius;
      } else if (this.y > canvas.height + this.radius) {
        this.y = 0 - this.radius;
      }
    }

    shoot() {
      if (!this.canShoot || bullets.length >= MAX_BULLETS) return;

      bullets.push(new Bullet(
        this.x + (4/3) * this.radius * Math.cos(this.angle),
        this.y - (4/3) * this.radius * Math.sin(this.angle),
        this.angle
      ));

      this.canShoot = false;
      this.shootTimer = Math.ceil(0.1 * FPS); // 100ms cooldown
    }

    draw() {
      // During invulnerability, blink the ship
      if (this.invulnerable && Math.floor(this.blinkCount / 10) % 2 === 0) {
        return; // skip drawing during half the blink cycle
      }

      // Draw ship
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();

      const noseX = this.x + (4/3) * this.radius * Math.cos(this.angle);
      const noseY = this.y - (4/3) * this.radius * Math.sin(this.angle);
      const leftX = this.x - this.radius * (Math.cos(this.angle) + 0.7 * Math.sin(this.angle));
      const leftY = this.y + this.radius * (Math.sin(this.angle) - 0.7 * Math.cos(this.angle));
      const rightX = this.x - this.radius * (Math.cos(this.angle) - 0.7 * Math.sin(this.angle));
      const rightY = this.y + this.radius * (Math.sin(this.angle) + 0.7 * Math.cos(this.angle));

      ctx.moveTo(noseX, noseY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.stroke();

      // Draw thruster flame
      if (this.thrusting) {
        ctx.beginPath();
        ctx.moveTo(leftX, leftY);

        // Flame fluctuation
        const flameSize = Math.random() * 0.5 + 1;
        const backX = this.x - this.radius * 1.5 * Math.cos(this.angle) * flameSize;
        const backY = this.y + this.radius * 1.5 * Math.sin(this.angle) * flameSize;

        ctx.lineTo(backX, backY);
        ctx.lineTo(rightX, rightY);
        ctx.strokeStyle = "orange";
        ctx.stroke();
      }

      // Center dot (debugging)
      if (SHOW_CENTER_DOT) {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2, false);
        ctx.fill();
      }
    }

    explode() {
      this.exploding = true;
      this.explodeTime = 0;
    }

    reset() {
      this.x = canvas.width / 2;
      this.y = canvas.height / 2;
      this.angle = Math.PI * 1.5; // point up
      this.rotation = 0;
      this.thrust = { x: 0, y: 0 };
      this.exploding = false;
      this.invulnerable = true;
      this.blinkCount = Math.ceil(this.invulnerableTime / this.blinkTime);
    }
  }

  // BULLET CLASS
  class Bullet {
    constructor(x, y, angle) {
      this.x = x;
      this.y = y;
      this.radius = 2;
      this.speed = BULLET_SPEED;
      this.xv = this.speed * Math.cos(angle);
      this.yv = -this.speed * Math.sin(angle);
      this.life = 0;
      this.lifeMax = BULLET_LIFE * FPS; // frames
    }

    update() {
      // Move bullet
      this.x += this.xv;
      this.y += this.yv;

      // Screen wrap
      if (this.x < 0) {
        this.x = canvas.width;
      } else if (this.x > canvas.width) {
        this.x = 0;
      }
      if (this.y < 0) {
        this.y = canvas.height;
      } else if (this.y > canvas.height) {
        this.y = 0;
      }

      // Count lifetime
      this.life++;

      // Return true if bullet is still alive
      return this.life < this.lifeMax;
    }

    draw() {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
      ctx.fill();
    }
  }

  // ASTEROID CLASS
  class Asteroid {
    constructor(x, y, size, speed = 1) {
      this.x = x || Math.random() * canvas.width;
      this.y = y || Math.random() * canvas.height;
      this.size = size || 3; // default large
      this.radius = this.getRadiusBySize(this.size);

      // Ensure asteroids don't spawn too close to the ship
      if (ship) {
        const distToShip = distBetweenPoints(this.x, this.y, ship.x, ship.y);
        if (!x && !y && distToShip < this.radius + ship.radius + 100) {
          // Too close, relocate
          this.x = ship.x + (canvas.width / 2) * (Math.random() > 0.5 ? 1 : -1);
          this.y = ship.y + (canvas.height / 2) * (Math.random() > 0.5 ? 1 : -1);

          // Wrap if outside canvas
          if (this.x < 0) this.x += canvas.width;
          else if (this.x > canvas.width) this.x -= canvas.width;
          if (this.y < 0) this.y += canvas.height;
          else if (this.y > canvas.height) this.y -= canvas.height;
        }
      }

      // Random velocity
      const baseSpeed = (ASTEROID_SPEED_MULT * (4 - this.size) / 2) * speed;
      this.xv = baseSpeed * (Math.random() * 2 - 1);
      this.yv = baseSpeed * (Math.random() * 2 - 1);

      // Polygon attributes
      this.vert = Math.floor(ASTEROID_VERT + Math.random() * 5);
      this.offsets = [];
      for (let i = 0; i < this.vert; i++) {
        this.offsets.push(Math.random() * ASTEROID_JAG * 2 + 1 - ASTEROID_JAG);
      }

      // Rotation
      this.angle = Math.random() * Math.PI * 2;
      this.rotation = Math.random() * 0.02 - 0.01;
    }

    getRadiusBySize(size) {
      if (size === 1) return ASTEROID_SIZE_SMALL;  // small
      if (size === 2) return ASTEROID_SIZE_MEDIUM; // medium
      return ASTEROID_SIZE_LARGE;                 // large
    }

    getPointsBySize(size) {
      if (size === 1) return ASTEROID_POINTS_SMALL;
      if (size === 2) return ASTEROID_POINTS_MEDIUM;
      return ASTEROID_POINTS_LARGE;
    }

    update() {
      // Move asteroid
      this.x += this.xv;
      this.y += this.yv;

      // Rotate
      this.angle += this.rotation;

      // Screen wrap
      if (this.x < 0 - this.radius) {
        this.x = canvas.width + this.radius;
      } else if (this.x > canvas.width + this.radius) {
        this.x = 0 - this.radius;
      }
      if (this.y < 0 - this.radius) {
        this.y = canvas.height + this.radius;
      } else if (this.y > canvas.height + this.radius) {
        this.y = 0 - this.radius;
      }
    }

    draw() {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const angle = (Math.PI * 2) / this.vert;
      for (let i = 0; i < this.vert; i++) {
        const x = this.x + this.radius * this.offsets[i] * Math.cos(this.angle + i * angle);
        const y = this.y + this.radius * this.offsets[i] * Math.sin(this.angle + i * angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.stroke();

      if (SHOW_CENTER_DOT) {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2, false);
        ctx.fill();
      }
    }

    break() {
      // Return array of new asteroids if this one breaks
      let newAsteroids = [];
      if (this.size > 1) {
        // Speed increase for smaller asteroids
        let speedIncrease = 1.2;

        // Create two smaller asteroids
        newAsteroids.push(new Asteroid(this.x, this.y, this.size - 1, speedIncrease));
        newAsteroids.push(new Asteroid(this.x, this.y, this.size - 1, speedIncrease));
      }
      return newAsteroids;
    }
  }

  // PARTICLE CLASS (for explosions)
  class Particle {
    constructor(x, y, color = "white", speed = 1) {
      this.x = x;
      this.y = y;
      this.radius = Math.random() * 3 + 1;
      this.color = color;
      this.speed = speed;

      // Random velocity
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * speed * 2 + 1;
      this.xv = Math.cos(angle) * velocity;
      this.yv = Math.sin(angle) * velocity;

      // Lifetime
      this.life = 0;
      this.lifeMax = Math.floor(Math.random() * 20 + 30);
      this.alpha = 1;
    }

    update() {
      // Move particle
      this.x += this.xv;
      this.y += this.yv;

      // Apply drag
      this.xv *= 0.98;
      this.yv *= 0.98;

      // Fade out
      this.life++;
      this.alpha = 1 - (this.life / this.lifeMax);

      // Still alive?
      return this.life < this.lifeMax;
    }

    draw() {
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // EXPLOSION CLASS (particle system)
  class Explosion {
    constructor(x, y, size, color = "white") {
      this.x = x;
      this.y = y;
      this.particles = [];

      // Create particles based on size
      const count = Math.floor(size / 5) + 10;
      const speed = size / 30 + 1;
      for (let i = 0; i < count; i++) {
        this.particles.push(new Particle(x, y, color, speed));
      }
    }

    update() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        if (!this.particles[i].update()) {
          this.particles.splice(i, 1);
        }
      }
      return this.particles.length > 0; // true if explosion still active
    }

    draw() {
      for (const particle of this.particles) {
        particle.draw();
      }
    }
  }

  // GLOBAL EXPLOSIONS ARRAY
  let explosions = [];

  // HELPER: Distance between two points
  function distBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // CREATE ASTEROIDS FOR THE CURRENT LEVEL
  function createAsteroids() {
    asteroids = [];

    // Number of asteroids = level + 3 (capped at 10)
    const count = Math.min(3 + level, 10);

    for (let i = 0; i < count; i++) {
      asteroids.push(new Asteroid(null, null, 3)); // size=3 => large asteroid
    }
  }

  // CHECK FOR COLLISIONS
  function checkCollisions() {
    // Bullet <-> Asteroid
    for (let b = bullets.length - 1; b >= 0; b--) {
      for (let a = asteroids.length - 1; a >= 0; a--) {
        const distance = distBetweenPoints(bullets[b].x, bullets[b].y, asteroids[a].x, asteroids[a].y);
        if (distance < bullets[b].radius + asteroids[a].radius) {
          // Bullet hits asteroid
          const brokenAsteroids = asteroids[a].break();

          // Increase score
          score += asteroids[a].getPointsBySize(asteroids[a].size);

          // Explosion
          explosions.push(new Explosion(asteroids[a].x, asteroids[a].y, asteroids[a].radius, "white"));

          // Remove bullet & asteroid
          bullets.splice(b, 1);
          asteroids.splice(a, 1);

          // Add newly broken asteroids (if any)
          asteroids = asteroids.concat(brokenAsteroids);

          break; // break from the asteroid loop
        }
      }
    }

    // Ship <-> Asteroid
    if (!ship.invulnerable) {
      for (let i = 0; i < asteroids.length; i++) {
        const distance = distBetweenPoints(ship.x, ship.y, asteroids[i].x, asteroids[i].y);
        if (distance < ship.radius + asteroids[i].radius) {
          // Ship is hit
          ship.explode();
          explosions.push(new Explosion(ship.x, ship.y, ship.radius * 2, "red"));

          lives--;
          if (lives <= 0) {
            endGame();
          } else {
            // Reset ship
            ship.reset();
          }
          break;
        }
      }
    }
  }

  // NEXT LEVEL
  function nextLevel() {
    level++;
    createAsteroids();
    ship.reset();
  }

  // GAME LOOP
  function updateGame() {
    // Update ship, bullets, asteroids, explosions
    ship.update();

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].update()) {
        bullets.splice(i, 1);
      }
    }

    // Update asteroids
    for (let i = 0; i < asteroids.length; i++) {
      asteroids[i].update();
    }

    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (!explosions[i].update()) {
        explosions.splice(i, 1);
      }
    }

    // Check collisions
    checkCollisions();

    // Check if level is cleared (asteroids = 0)
    if (asteroids.length === 0 && !gameOver) {
      nextLevel();
    }

    // Update DOM
    scoreDisplay.textContent = `Score: ${score}`;
    livesDisplay.textContent = `Lives: ${lives}`;
    levelDisplay.textContent = `Level: ${level}`;
  }

  function drawGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ship
    ship.draw();

    // Draw bullets
    for (let b of bullets) {
      b.draw();
    }

    // Draw asteroids
    for (let a of asteroids) {
      a.draw();
    }

    // Draw explosions
    for (let e of explosions) {
      e.draw();
    }
  }

  function gameLoop() {
    if (!gameOver && !paused) {
      updateGame();
      drawGame();
      requestAnimationFrame(gameLoop);
    }
  }

  // START THE GAME
  function startGame() {
    // Hide start screen
    startScreen.style.display = "none";

    // Reset leaderboard submission UI so user can submit score again
    scoreSubmitSection.style.display = "block";
    leaderboardSection.style.display = "none";

    // Reset game state
    gameStarted = true;
    gameOver = false;
    paused = false;
    score = 0;
    lives = 3;
    level = 1;
    bullets = [];
    asteroids = [];
    explosions = [];

    // Create ship
    ship = new Ship();

    // Create asteroids
    createAsteroids();

    // Begin the loop
    requestAnimationFrame(gameLoop);
  }

  // END GAME
  function endGame() {
    gameOver = true;
    // Show the game over screen
    finalScoreEl.textContent = score;
    gameOverScreen.style.display = "block";

    // Clear out any leftover username
    usernameInput.value = "";

    // Update high score if needed
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("asteroids-high-score", highScore);
    }
  }

  // RESTART GAME
  function restartGame() {
    // Hide game over screen
    gameOverScreen.style.display = "none";
    startGame();
  }

  // PAUSE GAME
  function pauseGame() {
    paused = true;
    pauseMenu.style.display = "block";
  }

  // RESUME GAME
  function resumeGame() {
    pauseMenu.style.display = "none";
    paused = false;
    requestAnimationFrame(gameLoop);
  }

  // QUIT GAME (go back to start screen)
  function quitGame() {
    pauseMenu.style.display = "none";
    gameOverScreen.style.display = "none";
    gameStarted = false;
    gameOver = false;
    paused = false;

    // Show start screen again
    startScreen.style.display = "flex";
  }

  // DISPLAY LEADERBOARD
  function displayLeaderboard() {
    // Sort leaderboard by descending score
    leaderboard.sort((a, b) => b.score - a.score);

    // Clear the list
    leaderboardList.innerHTML = "";

    // Populate the list
    leaderboard.forEach(entry => {
      const li = document.createElement("li");
      li.textContent = `${entry.name} - ${entry.score}`;
      leaderboardList.appendChild(li);
    });
  }

  // SUBMIT SCORE HANDLER
  function submitScore() {
    const username = usernameInput.value.trim();
    if (username === "") {
      alert("Please enter a username!");
      return;
    }

    // Add new entry to the leaderboard array
    leaderboard.push({ name: username, score });
    // Save to localStorage
    localStorage.setItem("asteroids-leaderboard", JSON.stringify(leaderboard));

    // Hide the score-submit section
    scoreSubmitSection.style.display = "none";

    // Display updated leaderboard
    leaderboardSection.style.display = "block";
    displayLeaderboard();
  }

  // EVENT LISTENERS
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", restartGame);
  resumeButton.addEventListener("click", resumeGame);
  quitButton.addEventListener("click", quitGame);
  submitScoreButton.addEventListener("click", submitScore);

  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);
  window.addEventListener("resize", resizeCanvas);

  // KEYDOWN HANDLER
  function keyDown(e) {
    // If game hasn't started or ended or is paused, ignore movement keys
    if (!gameStarted || gameOver || paused) return;

    switch(e.key) {
      case "ArrowUp":
      case "w":
        keys.up = true;
        break;
      case "ArrowDown":
      case "s":
        keys.down = true;
        break;
      case "ArrowLeft":
      case "a":
        keys.left = true;
        break;
      case "ArrowRight":
      case "d":
        keys.right = true;
        break;
      case " ":
        keys.space = true;
        if (ship) ship.shoot();
        break;
      case "Escape":
      case "p": // let ESC or "p" toggle pause
        pauseGame();
        break;
    }
  }

  // KEYUP HANDLER
  function keyUp(e) {
    switch(e.key) {
      case "ArrowUp":
      case "w":
        keys.up = false;
        break;
      case "ArrowDown":
      case "s":
        keys.down = false;
        break;
      case "ArrowLeft":
      case "a":
        keys.left = false;
        break;
      case "ArrowRight":
      case "d":
        keys.right = false;
        break;
      case " ":
        keys.space = false;
        break;
    }
  }

  // INITIAL SETUP
  setupCanvas();

  // On page load, display the leaderboard (though it's empty if no entries yet).
  // We won't show the scoreboard section unless user has ended game, but let's
  // keep it updated if you want to show it somewhere else in the future.
  displayLeaderboard();
});
