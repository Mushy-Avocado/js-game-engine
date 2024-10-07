const createGame = (function() {
    
    class Input {
    
    listeners = [];
    
    keys = {};
    
    constructor(scene) {
      this.scene = scene;
    
      this.on("keydown", event => {
          if (event.repeat) return;
          this.keys[event.keyCode] = this.keys[event.key] = true;
      });
    
      this.on("keyup", event => {
          this.keys[event.keyCode] = this.keys[event.key] = false;
      });
    }
    
    on(event, callback, config) {
      window.addEventListener(event, callback, config);
      let result = {
          event, callback, config,
      };
      this.listeners.push(result);
      return result;
    }
    
    off(eventData) {
      window.removeEventListener(eventData.event, eventData.callback, eventData.config);
    }
    
    unload() {
      this.listeners.forEach(listener => this.off(listener));
    }
    
    }
    
    class Sprite {
    
    drawTimestamp = -1;
    groups = new Set();
    image = "";
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    rotation = 0;
    offsetX = 0;
    offsetY = 0;
    isPushable = false;
    velocityX = 0;
    velocityY = 0;
    touching = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    
    get centerX() {
      return this.x + this.width / 2;
    }
    
    set centerX(value) {
      this.x = value - this.width / 2;
    }
    
    get centerY() {
      return this.y + this.height / 2;
    }
    
    set centerY(value) {
      this.y = value - this.height / 2;
    }
    
    get minX() {
      return this.x;
    }
    
    get minY() {
      return this.y;
    }
    
    get maxX() {
      return this.x + this.width;
    }
    
    get maxY() {
      return this.y + this.height;
    }
    
    get game() {
      return this.scene.game;
    }
    
    constructor(scene) {
      this.scene = scene;
    }
    
    update() {
      this.touching.up = false;
      this.touching.down = false;
      this.touching.left = false;
      this.touching.right = false;
      this.x += this.velocityX * this.scene.deltaTime;
      this.y += this.velocityY * this.scene.deltaTime;
      this.scene.physics.processCollisions(this);
    }
    
    render() {
      if (this.game.assets[this.image]) {
          var ctx = this.scene.game.ctx;
          ctx.save();
          ctx.translate(this.centerX + this.offsetX, this.centerY + this.offsetY);
          ctx.rotate(this.rotation * (Math.PI / 180));
          ctx.drawImage(this.game.assets[this.image], -this.width / 2, -this.height / 2, this.width, this.height);
          ctx.restore();
      }
    }
    
    draw() {
      // Avoid calling draw more than once a frame
      if (performance.now() === this.drawTimestamp) return;
      this.update();
      this.render();
      this.drawTimestamp = performance.now();
    }
    
    setImage(value) {
      this.image = value;
      return this; 
    }
    
    setPosition(x, y) {
      this.x = x;
      this.y = y;
      return this;
    }
    
    setRotation(value) {
      this.rotation = value;
      return this;
    }
    
    setSize(width, height) {
      this.width = width;
      this.height = height;
      return this;
    }
    
    setOffset(x, y) {
      this.offsetX = x;
      this.offsetY = y;
      return this;
    }
    
    setVelocity(x, y) {
      this.velocityX = x;
      this.velocityY = y;
      return this;
    }
    
    setPushable(bool) {
      this.isPushable = bool;
      return this;
    }
    
    force(x, y) {
      this.velocityX += x;
      this.velocityY += y;
      return this;
    }
    
    friction(x, y) {
      this.velocityX *= 1 - x;
      this.velocityY *= 1 - y;
      return this;
    }
    
    destroy() {
      this.groups.forEach(group => {
          group.remove(this);
      });
    }
    
    }
    
    class Group {
    
    sprites = new Set();
    groups = new Set();
    listeners = [];
    
    observe(callback) {
      this.listeners.push(callback);
    }
    
    add(sprite) {
      if (!sprite) return;
      sprite.groups.add(this);
      this.sprites.add(sprite);
      this.listeners.forEach(l => l(sprite));
    }
    
    remove(sprite) {
      this.sprites.delete(sprite);
    }
    
    clear() {
      this.sprites.clear();
    }
    
    iterate(callback, sprite) {
      for (let obj of this.sprites) {
          if (obj.iterate) {
              obj.iterate(obj => {
                  callback(obj);
              }, sprite);
          } else {
              callback(obj);
          }
      }
    }
    
    *iterator(sprite) {
      for (let obj of this.sprites) {
          if (obj.iterator) {
              yield* obj.iterator(sprite);
          } else {
              yield obj;
          }
      }
    }
    
    draw() {
      for (var sprite of this.sprites) {
          sprite.draw();
      }
    }
    
    destroy() {
      this.groups.forEach(group => {
          group.remove(this);
      });
      this.sprites.clear();
    }
    
    }
    
    class StaticGroup {
    
    sprites = new Map();
    groups = new Set();
    listeners = [];
    cellSize = 300;
    
    observe(callback) {
      this.listeners.push(callback);
    }
    
    getHash(x, y) {
      return `${x},${y}`;
    }
    
    getIndexBounds(sprite) {
      return {
          minX: Math.floor(sprite.minX / this.cellSize),
          minY: Math.floor(sprite.minY / this.cellSize),
          maxX: Math.floor(sprite.maxX / this.cellSize),
          maxY: Math.floor(sprite.maxY / this.cellSize),
      };  
    }
    
    add(sprite) {
      if (!sprite) return;
      let bounds = this.getIndexBounds(sprite);
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
          for (let y = bounds.minY; y <= bounds.maxY; y++) {
              let hash = this.getHash(x, y);
              if (!this.sprites.has(hash)) {
                  this.sprites.set(hash, new Group());
              }
              this.sprites.get(hash).add(sprite);
          }
      }
      this.listeners.forEach(l => l(sprite));
    }
    
    iterate(callback, sprite) {
      let bounds = this.getIndexBounds(sprite);
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
          for (let y = bounds.minY; y <= bounds.maxY; y++) {
              let hash = this.getHash(x, y);
              let group = this.sprites.get(hash);
              if (group) {
                  group.iterate(callback);
              }
          }
      }
    }
    
    *iterator(sprite) {
      let bounds = this.getIndexBounds(sprite);
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
          for (let y = bounds.minY; y <= bounds.maxY; y++) {
              let hash = this.getHash(x, y);
              let group = this.sprites.get(hash);
              if (group) {
                  yield* group.iterator();
              }
          }
      }
    }
    
    destroy() {
      this.sprites.clear();
      this.groups.forEach(group => {
          group.remove();
      });
    }
    
    }
    
    class Collider {
    constructor(callback = () => {}) {
      this.callback = callback;
      this.sprites = new Group();
    }
    }
    
    class ColliderFactory {
    
    constructor(engine) {
      this.engine = engine;
    }
    
    collider(a, b, callback) {
      if (!this.engine.colliders.has(a)) {
          this.engine.colliders.set(a, new Collider(callback));
      }
      if (a.observe) {
          for (let sprite of a.iterator()) {
              this.collider(sprite, b, callback);
          }
          a.observe(sprite => {
              this.collider(sprite, b, callback);
          });
      } else  {
          this.engine.colliders.get(a).sprites.add(b);
      }
    }
    
    overlap(a, b, callback = () => {}) {
      this.engine.overlaps.set({ a, b }, callback);
    }
    }
    
    class PhysicsEngine {
    
    colliders = new Map();
    overlaps = new Map();
    add = new ColliderFactory(this);
    
    processCollisions(sprite, iterations = 0) {
      let collider = this.colliders.get(sprite);
      if (collider) {
          for (let b of collider.sprites.iterator(sprite)) {
              this.collide(sprite, b);  
          }
      }
    }
    
    collide(a, b) {
      if (a === b) return;
      if (!this.overlap(a, b)) return;
      if (!a.isPushable && b.isPushable) {
          return void this.collide(b, a);
      }
      let relativeX = (b.centerX - a.centerX) / (b.width / 2);
      let relativeY = (b.centerY - a.centerY) / (b.height / 2);
      let distanceX = Math.abs(relativeX);
      let distanceY = Math.abs(relativeY);
      if (distanceY < distanceX && Math.abs(distanceX - distanceY) > a.velocityY / 50) {
          if (relativeX > 0) {
              // Collide left
              a.x = b.x - a.width;
              a.touching.right = b;
              b.touching.left = a;
          } else {
              // Collide right
              a.x = b.x + b.width;
              a.touching.left = b;
              b.touching.right = a;
          }
          a.velocityX = 0;
      } else {
          if (relativeY > 0) {
              // Collide top
              a.y = b.y - a.height;
              a.touching.down = b;
              b.touching.up = a; 
          } else {
              // Collide bottom
              a.y = b.y + b.height;
              a.touching.up = b;
              b.touching.down = a;
          }
          a.velocityY = 0;
      }
    }
    
    overlap(a, b) {
      if (a.iterator) {
          if (b.iterator) {
              // a and b are groups
              for (let spriteA of a.iterator(b)) {
                  for (let spriteB of b.iterator(a)) {
                      let overlap = this.overlap(spriteA, spriteB);
                      if (overlap) return overlap;
                  }
              } 
          } else {
              // a is a group, b is not
              for (let spriteA of a.iterator(b)) {
                  let overlap = this.overlap(spriteA, b);
                  if (overlap) return overlap;
              }
          }
      } else if (b.iterator) {
          // b is a group, a is not
          return this.overlap(b, a);
      } else {
          // a and b are not groups
          if (Math.abs(a.centerX - b.centerX) < (a.width + b.width) / 2 && Math.abs(a.centerY - b.centerY) < (a.height + b.height) / 2) {
              return { a, b };
          }
      }
      return null;
    }
    
    update() {
      for (let [between, callback] of this.overlaps) {
          let overlap = this.overlap(between.a, between.b);
          if (overlap) {
              callback(overlap.a, overlap.b);
          }
      }
    }
    
    }
    
    class SceneObjectFactory {
    
    constructor(scene) {
      this.scene = scene;
    }
    
    group() {
      return new Group();
    }
    
    sprite() {
      var sprite = new Sprite(this.scene);
      return sprite;
    }
    
    staticGroup() {
      return new StaticGroup();
    }
    
    }
    
    class Camera extends Sprite {
    
    constructor(scene) {
      super(scene);
      this.setSize(this.game.width, this.game.height);
    }
    
    push() {
      this.game.ctx.save();
      this.game.ctx.translate(-this.x, -this.y);
    }
    
    pop() {
      this.game.ctx.restore();
    }
    
    }
    
    class Scene {
    
    lastFrame = performance.now();
    
    get game() {
      return this.sceneManager.game;
    }
    
    constructor(sceneManager) {
      this.sceneManager = sceneManager;
      this.camera = new Camera(this);
      this.add = new SceneObjectFactory(this);
    }
    
    draw() {
    
    }
    
    _draw() {
      this.game.ctx.save();
      this.game.ctx.scale(this.game.scale, this.game.scale);
      this.game.ctx.fillStyle = "rgb(255, 255, 255)";
      this.game.ctx.fillRect(0, 0, this.game.width, this.game.height);
      this.deltaTime = Math.min((performance.now() - this.lastFrame) / 1000, 100 / 1000);
      this.lastFrame = performance.now();
      this.draw();
      this.physics.update();
      this.game.ctx.restore();
    }
    
    load(args) {
      this.input = new Input(this);
      this.physics = new PhysicsEngine();
      this.create.apply(this, args);
    }
    
    unload() {
      this.input.unload();
    }
    
    create() {
      
    }
    
    update() {
    
    }
    
    destroy(obj) {
      if (!obj) return;
      if (typeof obj.destroy === "function") {
          obj.destroy();
      }
    }
    
    }
    
    class SceneManager {
    
    scenes = {};
    loadedScene = null;
    game = null;
    
    constructor(game, scenes) {
      this.game = game;
      this.scenes = {};
      if (scenes) {
          for (let id of Object.keys(scenes)) {
              this.scenes[id] = new scenes[id](this);
          }
      }
      game.sceneManagers.push(this);
      this.draw();
    }
    
    draw() {
      if (this.loadedScene) {
          this.loadedScene._draw();
      }
    }
    
    load(id, ...args) {
      var scene = this.scenes[id] ?? null;
      if (this.loadedScene) {
          this.loadedScene.unload();
      }
      if (scene) {
          scene.load(args);
      }
      this.loadedScene = scene;
      
    }
    
    
    
    }
    
    window.gameInstances = [];
    
    class Game {
    
    static SceneManager = SceneManager;
    static Scene = Scene;
    static Sprite = Sprite;
    
    assets = {};
    sceneManagers = [];
    canvas = null;
    ctx = null;
    
    get index() {
      return window.gameInstances.indexOf(this);
    }
    
    get scale() {
      return Math.min(this.canvas.width / this.width, this.canvas.height / this.height);
    }
    
    constructor(width, height, canvas) {
      this.width = width;
      this.height = height;
      this.canvas = canvas;
      this.updateScaling();
      this.ctx = canvas.getContext("2d");
      window.gameInstances.push(this);
      setInterval(() => this.updateScaling(), 5000);
      window.addEventListener("resize", () => this.updateScaling());
      screen.orientation.addEventListener("change", () => this.updateScaling());
      this.updateScaling();
      this.draw();
    }
    
    updateScaling() {
      const boundingRect = this.canvas.parentElement.getBoundingClientRect();
      const ar = boundingRect.width / boundingRect.height;
      const targetAR = this.width / this.height;
    
      if (ar < targetAR) {
          this.canvas.width = boundingRect.width;
          this.canvas.height = boundingRect.width / targetAR;
          
          if (this.canvas.width > boundingRect.width) {
              const scaleFactor = boundingRect.width / this.canvas.width;
              this.canvas.style.scale = scaleFactor;
          }
      } else {
          this.canvas.width = boundingRect.height * targetAR; 
          this.canvas.height = boundingRect.height;
          
          if (this.canvas.height > boundingRect.height) {
              const scaleFactor = boundingRect.height / this.canvas.height;
              this.canvas.style.scale = scaleFactor;
          }
      }     
    }
    
    draw() {
      for (var i = 0; i < this.sceneManagers.length; i++) {
          this.sceneManagers[i].draw();
      }
      window.requestAnimationFrame(() => this.draw());
    }
    
    }
    
    async function createGame(config) {
    
    
    console.time("Load time");
    
    function getFunctionBody(func) {
      if (typeof func === "function") {
          func = func.toString();
      }
      return func.substring(func.indexOf("{") + 1, func.lastIndexOf("}"));
    }
    
    const style = `
    
      .sketch {
          width: fit-content;
          height: fit-content;
      }
    
      .sketch:focus {
          outline: none;
      }
    
      /* Automatically fits to the remaining height and centers the canvas it contains */
      #wrapper {
          margin: 0px;
          padding: 0px;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
      }
    
    `;
    
    const parent = config.parent ?? document.body;
    const canvas = document.createElement("canvas");
    
    var processingScript = document.createElement("script");
    await new Promise((resolve, reject) => {
      const pjsURL = 'https://cdn.jsdelivr.net/gh/Khan/processing-js@master/processing.js';
      if (!document.querySelector(`script[src='${pjsURL}']`)) {
          let script = document.createElement("script");
          script.src = pjsURL;
          script.type = "text/javascript";
          script.onload = () => {
              console.log("Processing.js library loaded from URL " + pjsURL);
              resolve();
          };
          document.head.appendChild(script);
      } else return void resolve();
    });
    
    parent.id = "wrapper";
    canvas.className = "sketch";
    parent.appendChild(canvas);
    const game = new Game(config.width, config.height, canvas);
    
    let styleElement = document.querySelector("style");
    if (!styleElement) {
      styleElement = document.createElement("style");
      document.head.appendChild(styleElement);
    }
    styleElement.textContent += style;
    
    var assetLoad = ""; 
    for (var [name, asset] of Object.entries(config.assets)) {
      assetLoad += `
          await waitForNextFrame();
          with (processing.createGraphics(${asset.width}, ${asset.height}, processing.P2D)) {
              size(${asset.width ?? 400}, ${asset.height ?? 400});
              background(0, 0);
              ${getFunctionBody(asset.load)}
              window.gameInstances["${game.index}"].assets["${name}"] = get(0, 0, ${asset.width}, ${asset.height}).sourceImg;
              background(0);
              noFill();
              strokeWeight(3);
              stroke(255);
              arc(width / 2, height / 2, 50, 50, 0 + Date.now() / 10, 180 + Date.now() / 10);
          }
      `;
    }
    var output = `
      function waitForNextFrame() {
          return new Promise((resolve, reject) => {
              window.requestAnimationFrame(resolve);
          });
      }
      (async function() {
          const processing = new Processing();
          ${assetLoad}
          console.timeEnd("Load time");
      })();
    `;
    function checkLoadedStatus() {
      if (Object.keys(config.assets).some(id => !game.assets[id])) {
          window.requestAnimationFrame(checkLoadedStatus);
      } else if (typeof config.onload === "function") {
          console.log("Finished loading assets");
          config.onload(game, Game);
      }
    }
    checkLoadedStatus();
    new Function(output)();
    }
    
    return createGame;
    
    
})();

export createGame;
