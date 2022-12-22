var server =require("../server/mock-server"),
Client=require("../../lib/node-rest-client").Client;

describe('Error Handlers', function () {
	
  this.timeout(150000);
	
  before(function () {
    server.listen(4444);
    console.log("server started on port 4444");
  });

  describe("Client Error Hanlers",function(){


    it("handle error with client handler", function(done){
      var client = new Client();
      client.on('error', function(err){        
        done();
      });
      client.get(server.baseURL + "/json/error", function(data, response){
        client.emit('error', response.status);  
      });

    });




  });

describe("#Request Error Handlers",function(){

   it("handle error with request handler", function(done){
      var client = new Client();

      var req =client.get(server.baseURL + "/json/error", function(data, response){
        req.emit('error', response.status); 
      });

      req.on('error',function(err){
        done();
      })

    });

});

after(function () {
  server.close();
  console.log("server stopped");
});

});