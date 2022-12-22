var server =require("../server/mock-server"),
Client=require("../../lib/node-rest-client").Client;

describe('POST Method', function () {
	
  this.timeout(150000);
	
  before(function () {
    server.listen(4444);
    console.log("server started on port 4444");
  });

  describe("#JSON",function(){

    it("POST request with path variable substitution", function(done){
      var client = new Client();
      var args ={
        path:{testNumber:123, testString:"test"},
        data:'{"dataNumber":123, "dataString":"test"}'

      };
      client.post(server.baseURL + "/json/path/post/${testNumber}/${testString}",args, function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/post/123/test");
        data.postData.should.equal('{"dataNumber":123, "dataString":"test"}');
        done();
      });
    });


    it("POST request with parameters", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"},
        data:'{"dataNumber":123,"dataString":"test"}'
      };
      client.post(server.baseURL + "/json/path/post/query",args, function(data, response){

        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/post/query?testNumber=123&testString=test");
        data.postData.should.equal('{"dataNumber":123,"dataString":"test"}');
        done();
      });
    });

    it("POST request with registered method and no args", function(done){
      var client = new Client();


      client.registerMethod("testMethod",server.baseURL + "/json","POST");

      client.methods.testMethod( function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        done();
      });
    });



    it("POST request with registered method and path variable substitution", function(done){
      var client = new Client();
      var args ={
        path:{testNumber:123, testString:"test"},
        data:'{"dataNumber":123,"dataString":"test"}'
      };

      client.registerMethod("testMethod",server.baseURL + "/json/path/post/${testNumber}/${testString}","POST");

      client.methods.testMethod(args, function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/post/123/test");
        data.postData.should.equal('{"dataNumber":123,"dataString":"test"}');
        done();
      });
    });


    it("POST request with registered method and parameters", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"},
        data:'{"dataNumber":123,"dataString":"test"}'
      };

      client.registerMethod("testMethod",server.baseURL + "/json/path/post/query","POST");

      client.methods.testMethod(args, function(data, response){
        data.should.not.equal(null);
        data.should.type("object");
        data.url.should.equal("/json/path/post/query?testNumber=123&testString=test");
        data.postData.should.equal('{"dataNumber":123,"dataString":"test"}');
        done();
      });
    });

    it("POST request with incompatible parameters URL", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"},
        data:{dataNumber:123, dataString:"test"}
      };

      client.on('error', function(err){
        err.should.startWith("parameters argument cannot be used if parameters are already defined in URL");
        done();
      });

      client.post(server.baseURL + "/json/path/post/query?testNumber=123&testString=test", args, function(data, response){
        // noop
      }).should.throw();

    });

    it("POST request with invalid args type", function(done){
      var client = new Client();
      var args = "123";

      client.on('error', function(err){
        err.should.startWith("args should be and object");
        done();
      });

      

      client.post(server.baseURL + "/json/path/post/query",args, function(data, response){
        // noop
      }).should.throw();

    });


    it("POST request with invalid parameters type", function(done){
      var client = new Client();
      var args ={
        parameters:"{test='123'}"
      };

      client.on('error', function(err){
        err.should.startWith("cannot serialize");
        done();
      });

      

      client.post(server.baseURL + "/json/path/post/query",args, function(data, response){
        // noop
      }).should.throw();

    });

    it("POST request with registered method and incompatible parameters URL", function(done){
      var client = new Client();
      var args ={
        parameters:{testNumber:123, testString:"test"},
        data:{dataNumber:123, dataString:"test"}
      };

      client.on('error', function(err){
        err.should.startWith("parameters argument cannot be used if parameters are already defined in URL");
        done();
      });

      client.registerMethod("testMethod",server.baseURL + "/json/path/post/query?testNumber=123&testString=test","POST");

      client.methods.testMethod(args, function(data, response){
        // noop
      }).should.throw();

    });

    it("POST request with registered method and invalid args type", function(done){
      var client = new Client();
      var args ="123";

      client.on('error', function(err){
        err.should.startWith("args should be and object");
        done();
      });

      client.registerMethod("testMethod",server.baseURL + "/json/path/post/query","POST");

      client.methods.testMethod(args, function(data, response){
        // noop
      }).should.throw();

    });


    it("POST request with registered method and invalid parameters type", function(done){
      var client = new Client();
      var args ={
        parameters:"{test='123'}"
      };

      client.on('error', function(err){
        err.should.startWith("cannot serialize");
        done();
      });

      client.registerMethod("testMethod",server.baseURL + "/json/path/post/query","POST");

      client.methods.testMethod(args, function(data, response){
        // noop
      }).should.throw();

    });
  });

describe("#XML",function(){

    it("POST request with parameters", function(done){
      var client = new Client();
      var args ={
        data:"<?xml version='1.0'?><testData><testNumber>123</testNumber><testString>123</testString></testData>"
      };
      client.post(server.baseURL + "/xml/path/post/query",args, function(data, response){ 
        data.should.type("object");
        data.testData.should.be.ok;
        data.testData.testNumber.should.be.ok;
        data.testData.testString.should.be.ok;
        data.testData.testNumber.should.be.a.Number;
        data.testData.testString.should.be.a.String;        
        data.testData.testNumber.should.be.equal("123");
        data.testData.testString.should.be.equal("123");
      
        
        done();
      });
    });

});

after(function () {
  server.close();
  console.log("server stopped");
});
});