var J = J || {};

J.controller = function(viewer) {

  this._viewer = viewer;

  this._last_id = null;

  this._merge_table = null;

  this._gl_merge_table_keys = null;
  this._gl_merge_table_values = null;
  this._merge_table_length = -1;

  this._lock_table = null;

  this._gl_lock_table = null;
  this._lock_table_length = -1;

  this._highlighted_id = null;

  this._activated_id = null;

  this._use_3d_labels = false;
  this._3d_labels = {};
  this._fixed_3d_labels = {};
  this._gl_3d_labels = null;
  this._gl_3d_labels_length = -1;

  this._origin = makeid() // TODO

  this._cursors = {};
  this._cursors_3d = {};


  this.create_gl_3d_labels();

};

J.controller.prototype.activate = function(id) {
  if (this._activated_id == id) return;

  this._activated_id = id;

  this._viewer.redraw();

  if (DOJO.threeD)
    this.add_3d_label(id);

}

J.controller.prototype.highlight = function(id) {
  if (this._highlighted_id == id) return;

  if (DOJO.threeD)
    this.highlight_in_3d(id);

  this._highlighted_id = id;

  this._viewer.redraw();   

}

J.controller.prototype.receive = function(data) {

  var input = JSON.parse(data.data);

  if (input.name == 'LOG') {
    DOJO.update_log(input);
    return;
  }

  if (input.origin == this._origin) {
    // we are the sender
    return;
  }

  if (input.name == 'WELCOME') {

    this.send('WELCOME', {});

  } else if (input.name == 'MERGETABLE') {

    // received new merge table
    this._viewer._controller.update_merge_table(input.value);

  } else if (input.name == 'LOCKTABLE') {

    // received new lock table
    this._viewer._controller.update_lock_table(input.value);

  } else if (input.name == 'REDRAW') {

    this._viewer.redraw();
    this.update_threeD();

  } else if (input.name == 'MOUSEMOVE') {

    if (DOJO.link_active)
      this.on_mouse_move(input.origin, input.id, input.value);

  }

};

J.controller.prototype.on_mouse_move = function(origin, id, value) {

  var i = value[0];
  var j = value[1];
  var k = value[2];

  // special case for 3d (we always show then)
  if (DOJO.threeD)
    this.on_mouse_move_3d(origin, id, i, j, k);

  if (k != this._viewer._camera._z) return;

  var x_y = this._viewer.ij2xy(i, j);

  var cursor = this._cursors[id];

  if (!cursor) {

    // clone the cursor
    cursor = document.getElementById('cursor').cloneNode();

    var color = this._viewer.get_color(id+100);

    cursor.style.backgroundColor = 'rgb('+color[0]+','+color[1]+','+color[2]+')';

    cursor.id = '';

    document.body.appendChild(cursor);

    this._cursors[id] = cursor;

  } 

  cursor.style.left = x_y[0];
  cursor.style.top = x_y[1];

  cursor.style.display = 'block';

};

J.controller.prototype.on_mouse_move_3d = function(origin, id, i, j, k) {

  var cursor = this._cursors_3d[id];

  var height = DOJO.threeD.volume.dimensions[2]*DOJO.threeD.volume.spacing[2] + 50;

  var x_y_z = this._viewer.ijk2xyz(i, j, k);

  if (!cursor) {

    var color = this._viewer.get_color(id+100);    

    cursor = new X.cube();
    cursor.lengthX = cursor.lengthY = cursor.lengthZ = 10;
    cursor.center = [0,0,-height];
    cursor.color = [color[0]/255, color[1]/255, color[2]/255];
    var line = new X.object();
    line.points = new X.triplets(6);
    line.normals = new X.triplets(6);
    line.type = 'LINES';
    line.points.add(0,0,0);
    line.points.add(0,0,-height);
    line.normals.add(0,0,0);
    line.normals.add(0,0,0);
    line.color = cursor.color;
    cursor.children.push(line);

    DOJO.threeD.renderer.add(cursor);

    this._cursors_3d[id] = cursor;

  }

  cursor.transform.matrix[12] = x_y_z[0];
  cursor.transform.matrix[13] = x_y_z[1];
  cursor.transform.matrix[14] = x_y_z[2];

  cursor.children[0].transform.matrix[12] = x_y_z[0];
  cursor.children[0].transform.matrix[13] = x_y_z[1];
  cursor.children[0].transform.matrix[14] = x_y_z[2];


};

J.controller.prototype.reset_cursors = function() {

  for (c in this._cursors) {
    document.body.removeChild(this._cursors[c]);
  }

  this._cursors = {};

};

J.controller.prototype.send = function(name, data) {

  var output = {};
  output.name = name;
  output.origin = this._origin;
  output.value = data;

  this._viewer._websocket.send(JSON.stringify(output));

};


///
///
///

J.controller.prototype.update_threeD = function() {

  if (DOJO.threeD) {
    DOJO.threeD.renderer.updateFromDojo(this._viewer._gl_colormap, 
                     this._viewer._max_colors,
                     this._gl_merge_table_keys, 
                     this._gl_merge_table_values, 
                     this._merge_table_length,
                     this._gl_3d_labels,
                     this._gl_3d_labels_length,
                     this._use_3d_labels);
  }

};

J.controller.prototype.update_merge_table = function(data) {

  // console.log('Received new merge table', data);

  this._merge_table = data;

  this.create_gl_merge_table();

};

J.controller.prototype.send_merge_table = function() {

  this.send('MERGETABLE', this._merge_table);

};

J.controller.prototype.send_lock_table = function() {

  this.send('LOCKTABLE', this._lock_table);

};

J.controller.prototype.send_mouse_move = function(i_j_k) {

  this.send('MOUSEMOVE', i_j_k);

}

J.controller.prototype.update_lock_table = function(data) {

  // console.log('Received new lock table', data);

  this._lock_table = data;

  this.create_gl_lock_table();

};

J.controller.prototype.send_log = function(message) {

  this.send('LOG', message);

};

J.controller.prototype.is_locked = function(id) {
  return (id in this._lock_table);
};

J.controller.prototype.lock = function(x, y) {

  if (!this._lock_table) {
    throw new Error('Lock table does not exist.');
  }

  var i_j = this._viewer.xy2ij(x, y);

  if (i_j[0] == -1 || i_j[1] == -1) return;

  this._viewer.get_segmentation_id(i_j[0], i_j[1], function(id) {

    var verb = 'locked';

    if (id in this._lock_table) {
      delete this._lock_table[id];

      // console.log('Unlocking', id);
      verb = 'unlocked';
    } else {
      this._lock_table[id] = true;
      // console.log('Locking', id);
    }

    var color1 = DOJO.viewer.get_color(id);
    var color1_hex = rgbToHex(color1[0], color1[1], color1[2]);
    var log = 'User $USER '+verb+' label <font color="'+color1_hex+'">'+id+'</font>.';

    this.send_log(log);

    this.create_gl_lock_table();

    this.send_lock_table();

    this._viewer.redraw();

  }.bind(this));

};

J.controller.prototype.merge = function(id) {

  if (!this._merge_table) {
    throw new Error('Merge-table does not exist.');
  }

  if (!this._last_id) {
    this._last_id = this._viewer.lookup_id(id);

    this.activate(id);

    return;
  }

  if (this._last_id == id) return;

  // console.log('Merging', this._last_id, id);

  // if (!(id in this._merge_table)) {
  //   this._merge_table[id] = [];
  // }

  // this._merge_table[id].push(this._last_id);

  this._merge_table[id] = this._last_id;

  var color1 = DOJO.viewer.get_color(id);
  var color1_hex = rgbToHex(color1[0], color1[1], color1[2]);
  var color2 = DOJO.viewer.get_color(this._last_id);
  var color2_hex = rgbToHex(color2[0], color2[1], color2[2]);

  var colored_id1 = id;
  var colored_id2 = this._last_id;

  var log = 'User $USER merged labels <font color="'+color1_hex+'">'+colored_id1+'</font> and <font color="'+color2_hex+'">' +colored_id2 + '</font>.';

  this.send_log(log);
  // shouldn't be required
  // DOJO.update_log(log);

  // this._viewer.redraw();

  this.create_gl_merge_table();

  // this._viewer.redraw();

  this.send_merge_table();

  this.highlight(this._last_id);

};

J.controller.prototype.create_gl_merge_table = function() {

  var keys = Object.keys(this._merge_table);
  var no_keys = keys.length;

  if (no_keys == 0) {

    // we need to pass an empty array to the GPU
    this._merge_table_length = 2;
    this._gl_merge_table_keys = new Uint8Array(4 * 2);
    this._gl_merge_table_values = new Uint8Array(4 * 2);
    return;

  }

  var new_length = Math.pow(2,Math.ceil(Math.log(no_keys)/Math.log(2)));

  this._merge_table_length = new_length;

  this._gl_merge_table_keys = new Uint8Array(4 * new_length);

  var pos = 0;
  for (var k=0; k<no_keys; k++) {
    // pack value to 4 bytes (little endian)
    var value = parseInt(keys[k],10);
    var b = from32bitTo8bit(value);
    this._gl_merge_table_keys[pos++] = b[0];
    this._gl_merge_table_keys[pos++] = b[1];
    this._gl_merge_table_keys[pos++] = b[2];
    this._gl_merge_table_keys[pos++] = b[3];
  }

  this._gl_merge_table_values = new Uint8Array(4 * new_length);

  pos = 0;
  for (var k=0; k<no_keys; k++) {
    // pack value to 4 bytes (little endian)
    var key = parseInt(keys[k],10);
    var value = this._merge_table[key];
    var b = from32bitTo8bit(value);
    this._gl_merge_table_values[pos++] = b[0];
    this._gl_merge_table_values[pos++] = b[1];
    this._gl_merge_table_values[pos++] = b[2];
    this._gl_merge_table_values[pos++] = b[3];
  }  

};

J.controller.prototype.create_gl_lock_table = function() {

  var keys = Object.keys(this._lock_table);
  var no_keys = keys.length;

  if (no_keys == 0) {

    // we need to pass an empty array to the GPU
    this._lock_table_length = 2;
    this._gl_lock_table = new Uint8Array(4 * 2);
    return;

  }

  var new_length = Math.pow(2,Math.ceil(Math.log(no_keys)/Math.log(2)));

  this._gl_lock_table = new Uint8Array(4 * new_length);

  this._lock_table_length = new_length;

  var pos = 0;
  for (var i=0; i<no_keys; i++) {

    var b = from32bitTo8bit(keys[i]);
    this._gl_lock_table[pos++] = b[0];
    this._gl_lock_table[pos++] = b[1];
    this._gl_lock_table[pos++] = b[2];
    this._gl_lock_table[pos++] = b[3];

  }

};

J.controller.prototype.create_gl_3d_labels = function() {

  var keys = Object.keys(this._3d_labels);
  var no_keys = keys.length;

  if (no_keys == 0) {

    // we need to pass an empty array to the GPU
    this._gl_3d_labels_length = 2;
    this._gl_3d_labels = new Uint8Array(4 * 2);
    return;

  }

  var new_length = Math.pow(2,Math.ceil(Math.log(no_keys)/Math.log(2)));

  this._gl_3d_labels = new Uint8Array(4 * new_length);

  this._gl_3d_labels_length = new_length;

  var pos = 0;
  for (var i=0; i<no_keys; i++) {

    var b = from32bitTo8bit(keys[i]);
    this._gl_3d_labels[pos++] = b[0];
    this._gl_3d_labels[pos++] = b[1];
    this._gl_3d_labels[pos++] = b[2];
    this._gl_3d_labels[pos++] = b[3];

  }

};

J.controller.prototype.is_3d_label = function(id) {

  return (id in this._3d_labels && id != this._highlighted_id);

};

J.controller.prototype.add_3d_label = function(id) {

  this._3d_labels[id] = true;

  this.create_gl_3d_labels();
  this.update_threeD();

};

J.controller.prototype.add_fixed_3d_label = function(id) {
  this._fixed_3d_labels[id] = true;


};

J.controller.prototype.remove_3d_label = function(id) {

  delete this._3d_labels[id];

  this.create_gl_3d_labels();
  this.update_threeD();

};

J.controller.prototype.remove_fixed_3d_label = function(id) {

  delete this._fixed_3d_labels[id];

};

J.controller.prototype.reset_3d_labels = function() {

  this._3d_labels = {};

  this._use_3d_labels = false;

  for (var k in this._fixed_3d_labels) {
    this._3d_labels[k] = true;

    this._use_3d_labels = true;
  }

  this.create_gl_3d_labels();

  

  this.update_threeD();


};

J.controller.prototype.reset_fixed_3d_labels = function() {

  this._fixed_3d_labels = {};

};

J.controller.prototype.highlight_in_3d = function(id, clear) {

  if (this._highlighted_id && !(this._highlighted_id in this._fixed_3d_labels))
    this.remove_3d_label(this._highlighted_id);

  this.add_3d_label(id);

  if (this._activated_id) {
    this.add_3d_label(this._activated_id);    
  }

  this._use_3d_labels = true;

};

J.controller.prototype.toggle_3d_labels = function() {

  this._use_3d_labels = !this._use_3d_labels;

  this.update_threeD();

};

J.controller.prototype.end_merge = function() {

  this.activate(null);
  this._last_id = null;

};
