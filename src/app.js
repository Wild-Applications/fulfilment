//Account service

//Imports
const grpc = require('grpc');
const fulfilmentHelper = require('./helpers/fulfilment.helper.js');
const proto = grpc.load(__dirname + '/proto/order.proto');
const server = new grpc.Server();
const mongoose = require('mongoose');
const dbUrl = "mongodb://wildappsadminmworder:pcNb2TNR47d3m7vA@ordercluster-shard-00-00-ekvf8.mongodb.net:27017,ordercluster-shard-00-01-ekvf8.mongodb.net:27017,ordercluster-shard-00-02-ekvf8.mongodb.net:27017/ORDERS?ssl=true&replicaSet=OrderCluster-shard-0&authSource=admin";

mongoose.connect(dbUrl);

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function () {
  console.log('Mongoose default connection open');
});

// If the connection throws an error
mongoose.connection.on('error',function (err) {
  console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {
  console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', function() {
  mongoose.connection.close(function () {
    console.log('Mongoose default connection disconnected through app termination');
    process.exit(0);
  });
});


//define the callable methods that correspond to the methods defined in the protofile
server.addService(proto.order.FulfilmentService.service, {
  getPending: function(call, callback){
    fulfilmentHelper.getPending(call, callback);
  },
  getCompleted: function(call, callback){
    fulfilmentHelper.getCompleted(call,callback);
  },
  get: function(call, callback){
    fulfilmentHelper.get(call, callback);
  },
  create: function(call, callback){
    fulfilmentHelper.create(call,callback);
  },
  update: function(call, callback){
    fulfilmentHelper.update(call,callback);
  },
  delete: function(call, callback){
    fulfilmentHelper.delete(call, callback);
  },
  capturePayment: function(call, callback){
    fulfilmentHelper.capture(call, callback);
  }

});

//Specify the IP and and port to start the grpc Server, no SSL in test environment
server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());

//Start the server
server.start();
console.log('gRPC server running on port: 50051');
