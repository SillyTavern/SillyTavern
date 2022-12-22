var ParserManager = function(){
	var registry={}, defaultParser = null;

	var _private={
		"validate":function(parser){

			function validateProperties(parser, props){
				var result = true;
				for (var propIndex in props){
					var propType  = props[propIndex].split(":");
					if (!parser.hasOwnProperty([propType[0]]) || typeof parser[propType[0]] !== propType[1]){
						result = false;
						break;
					}
				}

				return result;
			}


			result = validateProperties(parser,["name:string","parse:function","isDefault:boolean"]);

			// valid  parser, check if its not default response parser, to validate non
			// default parser props
			if (result && !parser.isDefault)
				result = validateProperties(parser,["match:function"]);
			

			return result;
		}
	};

	this.add = function(parser){
		if (!_private.validate(parser))
			throw "parser cannot be added: invalid parser definition";

		if (parser.isDefault){
			defaultParser = parser;
		}else{
			registry[parser.name] = parser;
		}
	};

	this.remove = function(parserName){
		var result = registry[parserName];
		if (!result)
			throw "cannot remove parser: " + parserName +" doesn't exists";

		delete registry[parserName];
	};

	this.clean = function(){
		registry={};
	};

	this.find = function(parserName){
		var result = registry[parserName];
		if (!result)
			throw "cannot find parser: " + parserName + " doesn't exists ";

		return result;
	};

	this.getDefault = function(){
		return defaultParser;
	};
	
	this.get = function(response){
		var result = null;
		for (var parserName in registry){
			if (registry[parserName].match(response)){
				result = registry[parserName];
				break;
			}
		}
		// if parser not found return default parser, else parser found
		return (result === null)?defaultParser:result;
	};

	this.getAll=function(){
		var result=[];		
		for (var parserName in registry){
			result.push(registry[parserName]);
		}
		return result;
	}
};


module.exports = function(){

var parserManager = new ParserManager();

var BaseParser = {
	"isDefault":false,	
	"match":function(response){
		var result = false,
		contentType = response.headers["content-type"] && response.headers["content-type"].replace(/ /g, '');

		if (!contentType) return result;

		for (var i=0; i<this.contentTypes.length;i++){
			result = this.contentTypes[i].trim().toLowerCase() === contentType.trim().toLowerCase();
			if (result) break;
		}

		return result;
	}
};

//add default parser managers: JSON,XML and unknown content/type
parserManager.add(Object.assign({
	"name":"XML",
	"options":{"explicitArray":false},	
	"contentTypes":["application/xml","application/xml;charset=utf-8","text/xml","text/xml;charset=utf-8"],
	"parseString":require('xml2js').parseString,
	"parse":function(byteBuffer,nrcEventEmitter,parsedCallback){
		this.parseString(byteBuffer.toString(),this.options, function (err, result) {
			parsedCallback(result);
		});
	}
}, BaseParser));

parserManager.add(Object.assign({
	"name":"JSON",	
	"contentTypes":["application/json","application/json;charset=utf-8"],
	"isValidData":function(data){
		return data !== undefined && (data.length !== undefined && data.length > 0);
	},	
	"parse":function(byteBuffer,nrcEventEmitter,parsedCallback){
		var jsonData,
		data = byteBuffer.toString();

		try {
			jsonData = this.isValidData(data)?JSON.parse(data):data;
		} catch (err) {
                // Something went wrong when parsing json. This can happen
                // for many reasons, including a bad implementation on the
                // server.
                nrcEventEmitter('error','Error parsing response. response: [' +data + '], error: [' + err + ']');
            }
            parsedCallback(jsonData);
        }
    },BaseParser));


parserManager.add({
	"name":"DEFAULT",
	"isDefault":true,
	"parse":function(byteBuffer,nrcEventEmitter,parsedCallback){
		parsedCallback(byteBuffer);
	}
});

return parserManager;
}
