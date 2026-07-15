/* ============================================================
   physics.js
   Shared Matter.js engine, runner, and helpers.
   All Matter.js bodies in the app live inside this single
   engine so they share a world. Modules create their own
   Matter.Bodies and Matter.Constraints but register them
   into Physics.world.
   ============================================================ */

window.Physics = (function () {
  const { Engine, Runner, World, Bodies, Body, Composite, Constraint } = Matter;

  const engine = Engine.create();
  engine.gravity.y = 1.0;
  engine.gravity.scale = 0.0011;
  // Optimize engine solver iterations for dense particle/constraint count
  engine.positionIterations = 2;
  engine.velocityIterations = 2;
  engine.constraintIterations = 2;

  const runner = Runner.create();
  // Do NOT start the runner automatically — scenes.js starts/stops
  // it as needed to save CPU when nothing is happening.

  // Forwards Matter namespace so other modules don't have to
  // re-destructure.
  const M = Matter;

  let running = false;

  function start() {
    if (running) return;
    Runner.run(runner, engine);
    running = true;
  }

  function stop() {
    if (!running) return;
    Runner.stop(runner);
    running = false;
  }

  function add(body) {
    World.add(engine.world, body);
  }

  function remove(body) {
    World.remove(engine.world, body);
  }

  function clearWorld() {
    World.clear(engine.world, false);
    Engine.clear(engine);
  }

  return {
    M,
    engine,
    runner,
    start,
    stop,
    add,
    remove,
    clearWorld,
    get running() { return running; }
  };
})();
