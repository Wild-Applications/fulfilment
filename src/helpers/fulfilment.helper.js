
//imports
var jwt = require('jsonwebtoken'),
Order = require('../models/order.schema.js'),
errors = require('../errors/errors.json'),
mongoose = require('mongoose');;

var grpc = require("grpc");
var paymentDescriptor = grpc.load(__dirname + '/../proto/payment.proto').payment;
var paymentClient = new paymentDescriptor.PaymentService('service.payment:1295', grpc.credentials.createInsecure());

var productDescriptor = grpc.load(__dirname + '/../proto/product.proto').product;
var productClient = new productDescriptor.ProductService('service.product:1295', grpc.credentials.createInsecure());

var premisesDescriptor = grpc.load(__dirname + '/../proto/premises.proto').premises;
var premisesClient = new premisesDescriptor.PremisesService('service.premises:1295', grpc.credentials.createInsecure());

var tableDescriptor = grpc.load(__dirname + '/../proto/table.proto').table;
var tableClient = new tableDescriptor.TableService('service.table:1295', grpc.credentials.createInsecure());

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

helper.getPending = function(call, callback){
  //protected route so verify token;
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    //we need to get the tokens premises
    //to verify that we own this order therefore can make changes to it


    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        return callback({message:err},null);
      }else{

        Order.find({
          $and: [
            {premises: result._id},
            {status: {$in: ['PENDING', 'IN_PROGRESS']}}
          ]
        }).exec(function(err, resultOrders){
          if(err){
            return callback(errors['0001'], null);
          }
          var results = [];
          resultOrders.forEach(function(order){
            results[results.length] = formatOrder(order);
          });

          getProducts(results, call.metadata).then(allData => {
            results = allData;
            getTables(results, call.metadata).then(newAllData => {
              results = newAllData;
              return callback(null, results);
            });
          }, error => {
            return callback(errors['0002'], null);
          })
        })
      }
    });
  });
}

helper.getCompleted = function(call, callback){
  //protected route so verify token;
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        return callback({message:err},null);
      }else{

        Order.find({
          $and: [
            {premises: result._id},
            {status: {$in: ['COMPLETE', 'CANCELLED', 'REFUNDED']}}
          ]
        }).exec(function(err, resultOrders){
          if(err){
            return callback(errors['0001'], null);
          }
          var results = [];
          resultOrders.forEach(function(order){
            results[results.length] = formatOrder(order);
          });

          getProducts(results, call.metadata).then(allData => {
            results = allData;
            getTables(results, call.metadata).then(newAllData => {
              results = newAllData;
              return callback(null, results);
            });
          }, error => {
            return callback(errors['0002'], null);
          })
        })
      }
    });
  });
}

helper.getCompletedByDay = function(call, callback){
  //protected route so verify token;
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        return callback({message:err},null);
      }else{
        Order.find({
          $and:[
            {premises: result._id},
            {status: {$in: ['COMPLETE', 'CANCELLED', 'REFUNDED']}},
            {createdAt: { $gte: new Date(call.request.year,parseInt(call.request.month) - 1,call.request.day)}},
            {createdAt: { $lt: new Date(call.request.year,parseInt(call.request.month) - 1,call.request.day,23,59,59,999)}}
          ]
        }).exec(function(err, resultOrders){
          if(err){
            return callback(errors['0001'], null);
          }

          var results = [];
          resultOrders.forEach(function(order){
            results[results.length] = formatOrder(order);
          });

          getProducts(results, call.metadata).then(allData => {
            results = allData;
            getTables(results, call.metadata).then(newAllData => {
              results = newAllData;
              return callback(null, results);
            });
          }, error => {
            return callback(errors['0002'], null);
          })
        });
      }
    });
  });
}

helper.getOrderBreakdown = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        return callback({message:err},null);
      }else{
        //aggregate orders based on premises match and day
        Order.aggregate([
          { $match: { $and: [
            {status: {$in: ['COMPLETE', 'CANCELLED', 'REFUNDED']}},
            {premises: mongoose.Types.ObjectId(result._id.toString())}
          ]}},
          {
            $group: {
              _id: {month: {$month: "$createdAt"}, day: {$dayOfMonth: "$createdAt"}, year: {$year: "$createdAt"}},
              count: { $sum: 1 }
            }
          },
          {
            $sort: {
              "_id.day": 1, "_id.month": 1, "_id.year": 1
            }
          }
        ]).exec(function(err, orders){
          if(err){
            return callback(errors['0001'], null);
          }
          console.log(orders);
          return callback(null, orders);
        })
      }
    });
  })
}


helper.get = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    Order.find({owner: token.sub}, function(orderErr, resultOrders){
      if(orderErr){
        return callback(errors['0001'], null);
      }
      var results = [];
      resultOrders.forEach(function(order){
        results[results.length] = formatOrder(order);
      });

      getProducts(results, call.metadata).then(allData => {
        results = allData;
        getTables(results, call.metadata).then(newAllData => {
          results = newAllData;
          getPremises(results, call.metadata).then(premisesAllData => {
            results = premisesAllData;
            return callback(null, results);
          });
        });
      }, error => {
        return callback(errors['0002'], null);
      })
    });
  });
}


helper.create = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }

    //validation handled by database
    var newOrder = new Order(call.request);
    newOrder.save(function(err, result){
      if(err){
        return callback(errors['0003'],null);
      }
      var order = {};
      order.subtotal = result.subtotal * 100;
      order.currency = 'gbp';
      order.premises = result.premises.toString();
      order.source = call.request.source;
      order.order = result._id.toString();
      order.storePaymentDetails = call.request.storePaymentDetails;

      paymentClient.createPayment(order, call.metadata, function(err, charges){
        if(err){
          result.remove(function(deleteError){
            if(deleteError){
              return callback(errors['0003'], null);
            }else{
              return callback(err,null);
            }
          })
        }
        return callback(null, {_id: result._id.toString()});
      })
    });
  });
}

helper.complete = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }
    Order.findOne({_id: call.request.order}, function(orderRetrievalError, order){
      if(orderRetrievalError){
        return callback(errors['0004'], null);
      }
      paymentClient.capturePayment({order: call.request.order}, call.metadata, function(paymentErr, response){
        if(paymentErr){
          var errorCode = paymentErr.metadata.get('error_code')[0];
          if(errorCode && errorCode.substr(errorCode.length - 4, 4) == '0006'){
            //payment didnt exist, so mark order as cancelled;
            order.status = "CANCELLED";
            order.save(() => {
              console.log('saved');
            });
          }
          return callback(paymentErr, null);
        }
        if(response && response.captured == false){
          order.status = "REFUNDED";
        }else{
          order.status = "COMPLETE";
        }
        order.save((err) => {
          console.log('save err', err);
          if(response.captured){
            return callback(null,response);
          }else{
            console.log(errors['0011']);
            var metadata = new grpc.Metadata();
            metadata.add('error_code', '04000011');
            var error = errors['0011'];
            error.metadata = metadata;
            return callback(error,null);
          }
        });
      })
    })
  });
}

helper.update = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback({message:err},null);
    }


    premisesClient.get({}, call.metadata, function(err, result){
      if(err){
        return callback(err, null);
      }else{
        Order.findOne({ $and: [{_id: call.request._id}, {premises: result._id}]}, function(err, order){
          if(err){
            return callback(errors['0001'], null);
          }
          delete call.request._id;
          for(var key in call.request.fieldsToUpdate){
            if(call.request.fieldsToUpdate[key] != "_id"){
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
        return callback(errors['0001'], null);
      }

      return callback(null, {});
    })
  });
}

helper.cancel = function(call, callback){
  jwt.verify(call.metadata.get('authorization')[0], process.env.JWT_SECRET, function(err, token){
    if(err){
      return callback(errors['0005'],null);
    }
    premisesClient.get({}, call.metadata, function(err, premises){
      if(err){
        return callback(errors['0006'],null);
      }else{
        Order.findOne({ $and: [
          {_id: call.request._id},
          {premises: premises._id}
        ]}, (err, order) => {
          if(err){
            return callback(errors['0006'], null);
          }
          if(order){
            paymentClient.refundPayment({order:order._id.toString()}, call.metadata, (err, result) => {
              if(err){
                var errorCode = err.metadata.get('error_code')[0];
                if(errorCode && errorCode.substr(errorCode.length - 4, 4) == '0006'){
                  //payment didnt exist, so mark order as cancelled;
                  order.status = 'CANCELLED';

                  order.save((err) => {

                  });
                }
                return callback(errors['0008'], null);
              }
              order.status = "CANCELLED";
              order.save((err) => {
                if(err){
                  return callback(errors['0007'], null);
                }
                return callback(null,{});
              });
            })
          }else{
            return callback(errors['0006'], null);
          }
        })
      }
    });
  });
}
//git
helper.wasRefunded = (call, callback) => {
  if(call.request.charge_id){
    paymentClient.wasRefunded({charge_id: call.request.charge_id}, (error, response) => {
      if(error){
        return callback(err, null);
      }
      Order.findOne({_id: response.order_id}, (err, order) => {
        if(err){
          return callback(errors['0001'], null);
        }
        order.status = 'REFUNDED';
        order.save((err) => {
          if(err){
            return callback(errors['0010'], null);
          }
          return callback(null, {acknowledged: true});
        })
      });
    });
  }else{
    return callback(errors['0009'], null);
  }
}

function getProducts(orders, metadata){


  var productsCall = function(order, metadata){
    return new Promise(function(resolve, reject){
      if(order.products.length > 0){
        productClient.getBatch(order.products, metadata, function(err, results){
          if(err){return reject(err)}
          var resultProductArray = [];
          order.products.forEach(function(product){
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

function getPremises(orders, metadata){
  var premisesCall = function(order, metadata){
    return new Promise(function(resolve, reject){
      premisesClient.getPremises({premisesId: order.premises}, metadata, function(err, result){
        if(err){return reject(err)}
        order.premises = result;
        return resolve(order);
      })
    })
  }

  var requests = [];
  orders.forEach(function(order){
    requests[requests.length] = premisesCall(order, metadata);
  })

  //return requests;

  return Promise.all(requests);
}



module.exports = helper;
