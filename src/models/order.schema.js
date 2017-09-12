var mongoose = require('mongoose');


function setPrice(p){
    return p * 100;
}

function getPrice(p){
  return parseFloat((p/100).toFixed(2));
}

var schema = new mongoose.Schema({
  subtotal: {type: Number, required: true, default: 0, get: getPrice, set: setPrice},
  owner: { type : Number, required : true, index: true},
  products: [{type: mongoose.Schema.ObjectId, ref: 'Product'}],
  table: {type: mongoose.Schema.ObjectId, required: true, ref:'Table'},
  premises: {type: mongoose.Schema.ObjectId, required: true, ref:'Premises', index: true},
  status: { type: String, enum:['PENDING','IN_PROGRESS', 'COMPLETE', 'CANCELLED'], default: 'PENDING', required: true }
}, {
  timestamps: true
});


schema.set('toJSON', {getters: true, setters:true});

module.exports = mongoose.model('Order', schema);
