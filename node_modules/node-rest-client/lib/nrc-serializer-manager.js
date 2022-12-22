var xmlserializer = require('xml2js');

var SerializerManager = function(){
	var registry={}, defaultSerializer = null;

	var _private={
		"validate":function(serializer){

			function validateProperties(serializer, props){
				var result = true;
				for (var propIndex in props){
					var propType  = props[propIndex].split(":");
					if (!serializer.hasOwnProperty([propType[0]]) || typeof serializer[propType[0]] !== propType[1]){
						result = false;
						break;
					}
				}

				return result;
			}


			result = validateProperties(serializer,["name:string","serialize:function","isDefault:boolean"]);

			// valid  serializer, check if its not default request serializer, to validate non
			// default serializer props
			if (result && !serializer.isDefault)
				result = validateProperties(serializer,["match:function"]);
			

			return result;
		}
	};

	this.add = function(serializer){
		if (!_private.validate(serializer))
			throw "serializer cannot be added: invalid serializer definition";

		if (serializer.isDefault){
			defaultSerializer = serializer;
		}else{
			registry[serializer.name] = serializer;
		}
	};

	this.remove = function(serializerName){
		var result = registry[serializerName];
		if (!result)
			throw "cannot remove serializer: " + serializerName +" doesn't exists";

		delete registry[serializerName];
	};

	this.find = function(serializerName){
		var result = registry[serializerName];
		if (!result)
			throw "cannot find serializer: " + serializerName +" doesn't exists";

		return result;
	};
	
	
	this.clean = function(){
		registry={};
	};

	this.get = function(request){
		var result = null;
		for (var serializerName in registry){
			if (registry[serializerName].match(request)){
				result = registry[serializerName];
				break;
			}
		}
		// if serializer not found return default serializer, else serializer found
		return (result === null)?defaultSerializer:result;
	};

	this.getAll=function(){
		var result = [];		
		for (var serializerName in registry){
			result.push(registry[serializerName]);
		}
		return result;
	};

	this.getDefault = function(){
		return defaultSerializer;
	};
};




module.exports = function(){

var serializerManager = new SerializerManager();

var BaseSerializer ={
	"isDefault":false,		
	"match":function(request){
		var result = false,
		contentType = request.headers["Content-Type"] && request.headers["Content-Type"].replace(/ /g, '');

		if (!contentType) return result;

		for (var i=0; i<this.contentTypes.length;i++){
			result = this.contentTypes[i].trim().toLowerCase() === contentType.trim().toLowerCase();
			if (result) break;
		}

		return result;
	}
};


//add default serializer managers: JSON,XML and unknown content/type
serializerManager.add(Object.assign({
	"name":"XML",
	"options":{},	
	"contentTypes":["application/xml","application/xml;charset=utf-8","text/xml","text/xml;charset=utf-8"],
	"xmlSerializer":new xmlserializer.Builder(this.options),	
	"serialize":function(data,nrcEventEmitter,serializedCallback){
		if (typeof data === 'object')
			data = xmlSerializer.buildObject(data);

		serializedCallback(data);
	
	}
},BaseSerializer));

serializerManager.add(Object.assign({
	"name":"JSON",	
	"contentTypes":["application/json","application/json;charset=utf-8"],	
	"serialize":function(data,nrcEventEmitter,serializedCallback){
		if(typeof data === 'object')
			data = JSON.stringify(data);
		serializedCallback(data);
    }
},BaseSerializer));


serializerManager.add(Object.assign({
	"name":"FORM-ENCODED",
	"contentTypes":["application/x-www-form-urlencoded","multipart/form-data","text/plain"],
	"encode":function (obj, parent) {
              var tokens = [], propertyName;
              //iterate over all properties
              for(propertyName in obj) {
                  //if object has property (it's not an array iteration)
                  if (obj.hasOwnProperty(propertyName)) {
                  //if property has parent, add nested reference  
                  var parsedProperty = parent ? parent + "[" + propertyName + "]" : propertyName, propertyValue = obj[propertyName];

                  // if property has value and is object (we must iterate again, not final leaf)
                  // iterate over object property passing current parsed property as parent
                  // else add encoded parsed property and value to result array
                  tokens.push((propertyValue !== null && typeof propertyValue === "object") ?
                    serialize(propertyValue, parsedProperty) :
                    encodeURIComponent(parsedProperty) + "=" + encodeURIComponent(propertyValue));
                    }
                }
                    return tokens.join("&");
    },	
	"serialize":function(data,nrcEventEmitter,serializedCallback){
		if(typeof data === 'object')
			data = this.encode(data);

		serializedCallback(data);
    	}
	},BaseSerializer));


serializerManager.add({
	"name":"DEFAULT",
	"isDefault":true,
	"serialize":function(data,nrcEventEmitter,serializedCallback){
		
		serializedCallback(data.toString());
	}
});

return serializerManager;

};