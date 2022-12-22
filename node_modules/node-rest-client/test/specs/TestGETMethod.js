var server =require("../server/mock-server"),
Client=require("../../lib/node-rest-client").Client;

describe('GET Method', function () {
	
  this.timeout(150000);
	
  before(function () {
    server.listen(4444);
    console.log("server started on port 4444");
  });

  describe("#JSON",function(){

    it("GET request with no args", function(done){
      var client = new Client();
      client.get(server.baseURL + "/json", function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        done();
      });
    });

    it("GET request with path variable substitution", function(done){
      var client = new Client();
      var args ={
        path:{testNumber:123, testString:"test"}
      };
      client.get(server.baseURL + "/json/path/${testNumber}/${testString}",args, function(data, response){

        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/123/test");
        done();
      });
    });


    it("GET request with parameters", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"}
      };
      client.get(server.baseURL + "/json/path/query",args, function(data, response){

        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/query?testNumber=123&testString=test");
        done();
      });
    });

    it("GET request with registered method and no args", function(done){
      var client = new Client();


      client.registerMethod("testMethod",server.baseURL + "/json","GET");

      client.methods.testMethod( function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        done();
      });
    });



    it("GET request with registered method and path variable substitution", function(done){
      var client = new Client();
      var args ={
        path:{testNumber:123, testString:"test"}
      };

      client.registerMethod("testMethod",server.baseURL + "/json/path/${testNumber}/${testString}","GET");

      client.methods.testMethod(args, function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/123/test");
        done();
      });
    });


    it("GET request with registered method and parameters", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"}
      };

      client.registerMethod("testMethod",server.baseURL + "/json/path/query","GET");

      client.methods.testMethod(args, function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/query?testNumber=123&testString=test");
        
        done();
      });
    });

    it("GET request with incompatible parameters URL", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"}
      };

      client.on('error', function(err){
        err.should.startWith("parameters argument cannot be used if parameters are already defined in URL");
        done();
      });

      client.get(server.baseURL + "/json/path/query?testNumber=123&testString=test", args, function(data, response){
        //noop
      }).should.throw();

    });

    it("GET request with invalid args type", function(done){
      var client = new Client();
      var args = "123";

      client.on('error', function(err){
        err.should.startWith("args should be and object");
        done();
      });

      

      client.get(server.baseURL + "/json/path/query",args, function(data, response){
        //noop
      }).should.throw();

    });


    it("GET request with invalid parameters type", function(done){
      var client = new Client();
      var args ={
        parameters:"{test='123'}"
      };

      client.on('error', function(err){
        err.should.startWith("cannot serialize");
        done();
      });

      

      client.get(server.baseURL + "/json/path/query",args, function(data, response){
        //noop
      }).should.throw();

    });

    it("GET request with registered method and incompatible parameters URL", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"}
      };

      client.on('error', function(err){
        err.should.startWith("parameters argument cannot be used if parameters are already defined in URL");
        done();
      });

      client.registerMethod("testMethod",server.baseURL + "/json/path/query?testNumber=123&testString=test","GET");

      client.methods.testMethod(args, function(data, response){
        //noop
      }).should.throw();

    });

    it("GET request with registered method and invalid args type", function(done){
      var client = new Client();
      var args ="123";

      client.on('error', function(err){
        err.should.startWith("args should be and object");
        done();
      });

      client.registerMethod("testMethod",server.baseURL + "/json/path/query","GET");

      client.methods.testMethod(args, function(data, response){
        //noop
      }).should.throw();

    });


    it("GET request with registered method and invalid parameters type", function(done){
      var client = new Client();
      var args ={
        parameters:"{test='123'}"
      };

      client.on('error', function(err){
        err.should.startWith("cannot serialize");
        done();
      });

      client.registerMethod("testMethod",server.baseURL + "/json/path/query","GET");

      client.methods.testMethod(args, function(data, response){
        //noop
      }).should.throw();

    });
  });


describe("#XML",function(){

  it("GET request with no args", function(done){
    var client = new Client();
    client.get(server.baseURL + "/xml", function(data, response){
      console.log("data es ", data);
      data.should.not.equal(null);
      data.should.type("object");
      done();
    });
  });

});

after(function () {
  server.close();
  console.log("server stopped");
});
});