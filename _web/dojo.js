
// The DOJO namespace
var DOJO = DOJO || {};

DOJO.mode = null;
DOJO.modes = {
  pan_zoom:0, 
  merge:1
};

DOJO.init = function() {

  DOJO.viewer = new J.viewer('dojo1');
  DOJO.viewer.init(function() {

    DOJO.update_slice_number(1);

  });

  DOJO.setup_buttons();

};

DOJO.setup_buttons = function() {

  var merge = document.getElementById('merge');

  merge.onclick = function() {

    if (DOJO.mode != DOJO.modes.merge) {

      merge.style.border = '1px solid white';

      DOJO.mode = DOJO.modes.merge;

    } else {

      merge.style.border = '';

      DOJO.mode = DOJO.modes.pan_zoom;

    }

  };

};

DOJO.onleftclick = function(x, y) {

  // get pixel coordinates
  var i_j = DOJO.viewer.xy2ij(x,y);

  if (i_j[0] == -1) return;
  
  DOJO.viewer.get_segmentation_id(i_j[0], i_j[1], function(id) {
    console.log(i_j, id);
  });

};

DOJO.update_slice_number = function(n) {

  var slicenumber = document.getElementById('slicenumber');
  slicenumber.innerHTML = n+'/'+DOJO.viewer._image.max_z_tiles;

};

DOJO.update_label = function(x, y) {

  var i_j = DOJO.viewer.xy2ij(x,y);

  var label = document.getElementById('label');

  if (i_j[0] == -1) {
    label.innerHTML = 'Label n/a';
    return;
  }

  DOJO.viewer.get_segmentation_id(i_j[0], i_j[1], function(id) {

    var color = DOJO.viewer.get_color(id);
    var color_hex = rgbToHex(color[0], color[1], color[2]);

    label.innerHTML = 'Label <font color="' + color_hex + '">' + id + '</font>';

  });

};