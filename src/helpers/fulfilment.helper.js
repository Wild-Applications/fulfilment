
//imports
var jwt = require('jsonwebtoken'),
Order = require('../models/order.schema.js');



//var jwt = require('jsonwebtoken');
//var tokenService = require('bleuapp-token-service').createTokenHandler('service.token', '50051');

var helper = {};

function formatOrder(order){
  var formatted = {};
  formatted._id = order._id.toString();
  formatted.subtotal = order.subtotal;
  formatted.products = order.products;
  formatted.table = order.table.toString();
  formatted.premises = order.premises.toString();
  formatted.status = order.status;
  formatted.owner = order.owner;
  formatted.createdAt = order.createdAt.toString();
  return formatted;
}

helper.getAll = function(call, callback){
  //protected route so verify token;
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    //we need to get the tokens premises
    //to verify that we own this order therefore can make changes to it
    var grpc = require("grpc");
    var premisesDescriptor = grpc.load(__dirname + '/../proto/premises.proto').premises;
    var premisesClient = new premisesDescriptor.PremisesService('service.premises:1295', grpc.credentials.createInsecure());


    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        res.send(err);
      }else{
        Order.find({ premises: result._id }).exec(function(err, resultOrders){
          if(err){
            return callback({message:err.message,test:"test"}, null);
          }

          var results = [];
          resultOrders.forEach(function(order){
            results[results.length] = formatOrder(order);
          });

          getProducts(results, call.metadata).then(allData => {
            results = allData;
            console.log('RESULTS ' + results.length);
            getTables(results, call.metadata).then(newAllData => {
              results = newAllData;
              return callback(null, results);
            });
          }, error => {
            callback({message:error},null);
          })
        })
      }
    });
  });
}

helper.get = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    //we need to get the tokens premises
    //to verify that we own this order therefore can make changes to it
    var grpc = require("grpc");
    var premisesDescriptor = grpc.load(__dirname + '/../proto/premises.proto').premises;
    var premisesClient = new premisesDescriptor.PremisesService('service.premises:1295', grpc.credentials.createInsecure());


    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        return callback(err, null);
      }else{
        Order.findOne({ $and: [{_id: call.request._id}, {premises: result._id}]}).exec(function(err, resultOrder){
          if(err){
            return callback({message:JSON.stringify(err)}, null);
          }

          return callback(null, formatOrder(resultOrder));
        })
      }
    });
  });
}


helper.create = function(call, callback){
  //validation handled by database
  var newOrder = new Order(call.request);
  newOrder.save(function(err, result){
    if(err){
      return callback({message:'err'},null);
    }
    return callback(null, {_id: result._id.toString()});
  });
}

helper.update = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    //we need to get the tokens premises
    //to verify that we own this order therefore can make changes to it
    var grpc = require("grpc");
    var premisesDescriptor = grpc.load(__dirname + '/../proto/premises.proto').premises;
    var premisesClient = new premisesDescriptor.PremisesService('service.premises:1295', grpc.credentials.createInsecure());


    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        res.send(err);
      }else{
        Order.findOne({ $and: [{_id: call.request._id}, {premises: result._id}]}, function(err, order){
          if(err){
            return callback({message:err}, null);
          }
          delete call.request._id;
          for(var key in call.request.fieldsToUpdate){
            if(call.request.fieldsToUpdate[key] != "_id"){
              console.log("updating " + call.request.fieldsToUpdate[key]);
              console.log("from " + order[call.request.fieldsToUpdate[key]]);
              console.log("to " + call.request[call.request.fieldsToUpdate[key]]);
              order[call.request.fieldsToUpdate[key]] = call.request[call.request.fieldsToUpdate[key]];
            }
          }
          order.save();
          return callback(null, {_id: order._id.toString()});
        });
      }
    });
  });
}

helper.delete = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    Order.findByIdAndRemove({ $and: [{_id: call.request._id}, {owner: token.sub}]}, function(err, orderReply){
      if(err){
        console.log(err);

        return callback({message:'err'}, null);
      }

      return callback(null, {});
    })
  });
}

function getProducts(orders, metadata){
  var grpc = require("grpc");
  var productDescriptor = grpc.load(__dirname + '/../proto/product.proto').product;
  var productClient = new productDescriptor.ProductService('service.product:1295', grpc.credentials.createInsecure());



  var productsCall = function(order, metadata){
    return new Promise(function(resolve, reject){
      if(order.products.length > 0){
        productClient.getBatch(order.products, metadata, function(err, results){
          if(err){return reject(err)}
          var resultProductArray = [];
          order.products.forEach(function(product){
            console.log(product);
            console.log(results);
            for(var i=0;i<results.products.length;i++){
              if(results.products[i]._id.toString() == product.toString()){
                resultProductArray[resultProductArray.length] = results.products[i];
                break;
              }
            }
          });
          order.products = resultProductArray;
          return resolve(order);
        });
      }else{
        resolve(order);
      }
    })
  }

  var requests = [];
  orders.forEach(function(order){
    for(var i=0;i<order.products.length;i++){
      order.products[i] = order.products[i].toString();
      order.table = order.table.toString();
    }
    requests[requests.length] = productsCall(order, metadata);
  })

  //return requests;

  return Promise.all(requests);
}

function getTables(orders, metadata){
  var grpc = require("grpc");
  var tableDescriptor = grpc.load(__dirname + '/../proto/table.proto').table;
  var tableClient = new tableDescriptor.TableService('service.table:1295', grpc.credentials.createInsecure());
  console.log("requesting for " + orders.length);
  var tableCall = function(order, metadata){
    return new Promise(function(resolve, reject){
      tableClient.get({_id: order.table}, metadata, function(err, result){
        if(err){return reject(err)}
        order.table = result;
        return resolve(order);
      })
    })
  }

  var requests = [];
  orders.forEach(function(order){
    requests[requests.length] = tableCall(order, metadata);
  })

  //return requests;

  return Promise.all(requests);

}



module.exports = helper;
