var mongoose = require('mongoose');


var schema = new mongoose.Schema({
  subtotal: {type: Number, required: true, default: 0},
  owner: { type : Number, required : true, index: true},
  products: [{type: mongoose.Schema.ObjectId, ref: 'Product'}],
  table: {type: mongoose.Schema.ObjectId, required: true, ref:'Table'},
  premises: {type: mongoose.Schema.ObjectId, required: true, ref:'Premises', index: true},
  status: { type: String, enum:['PENDING','IN_PROGRESS', 'COMPLETE', 'CANCELLED', 'REFUNDED'], default: 'PENDING', required: true }
}, {
  timestamps: true
});


schema.path('subtotal').set(function(p){
  return p * 100;
});

schema.path('subtotal').get(function(p){
  return parseFloat((p/100).toFixed(2));
});

schema.set('toJSON', {getters: true, setters:true});
schema.set('toObject', {getters: true, setters:true});

module.exports = mongoose.model('Order', schema);
