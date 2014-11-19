/*
 * Sails application launcher.
 *
 */

//==============================================================================

before(function(done) {
  require("sails").lift({
    log: {
      level: "silent"
    },
    paths: {
      models: require("path").join(process.cwd(), "test/fixtures/models")
    },
    connections: {
      memory: {
        adapter: "sails-memory"
      }
    },
    models: {
      connection: 'memory',
      migrate: 'drop'
    },
    session: {
      secret: "s.e.c.r.e.t"
    },
    hooks: {
      grunt: false
    }
  }, function(err, sails) {
    done(err);
  });
});

//------------------------------------------------------------------------------

after(function(done) {
  (typeof sails != "undefined") ? sails.lower(done) : done();
});
