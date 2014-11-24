module.exports = function(Factory) {
  Factory.define("sub")
    .attr("sample", "sample1", {association: true});
};
