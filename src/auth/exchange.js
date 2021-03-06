module.exports = (function() {
  "use strict";

  var request = require("request"),
      Utils = require("../utils");

  /**
   * Third part of oauth: exchange request token for access token
   */
  var ExchangeTokens = function(options, requestCompleted) {
    options = Utils.setAuthVals(options);

    var queryArguments = {
          oauth_consumer_key:     options.key,
          oauth_nonce:            options.oauth_nonce,
          oauth_signature_method: "HMAC-SHA1",
          oauth_timestamp:        options.oauth_timestamp,
          // new values:
          oauth_token: options.oauth_token,
          oauth_verifier: options.oauth_verifier
        };

    var queryString = Utils.formQueryString(queryArguments);
    var data = Utils.formBaseString(this.url, queryString);
    var signature = Utils.sign(data, options.secret, options.oauth_token_secret);
    var flickrURL = this.url + "?" + queryString + "&oauth_signature=" + signature;
    request.get(flickrURL, function(error, response, body) {
      requestCompleted(error, body);
    });
  };

  ExchangeTokens.prototype = {
    url: "http://www.flickr.com/services/oauth/access_token"
  };

  return ExchangeTokens;
}());