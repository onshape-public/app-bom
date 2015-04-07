======================================
jQuery Plugin - Query Parameter Parser
======================================

This is a plugin that adds two functions to the jQuery global object for parsing query parameters. It will automatically decode URI encoded values and restore any spaces that may have been replaced with the plus sign.

You can see the plugin in action at:
	
	http://jsfiddle.net/mattsnider/spHAD/

$.parseQuery(s)
=====================

This function accepts a query string and returns a JavaScript object on which the query string key/value pairs are applied. So passing the following query string:

	$.parseQuery('?&key1=value1&key2=value2');

Will return the object:

	{
		key1: 'value1',
		key2: 'value2'
	}
	
	
$.getQuery()
==================

This is a shortcut method that passing `window.location.search` to `$.parseQuery` and cached the result. So calling `$.getQuery` on the url `http://www.myserver.com/?&foo=bar&foofoo=baz` will return:

Will return the object:

	{
		foo: 'bar',
		foofoo: 'baz'
	}
	
Improperly Formatted Queries
============================

The regex is robust enough handle lots of improperly formatted strings.

Good values, wrapped with crap
------------------------------

The regex can find properly formatted query parameters anyplace in a string, even if proceeded and succeed with crap:

	$.parseQuery('?jjsdlgalgdja&foo=bar&adfasdfasdfasdfa');
	
Will return the object:

	{
		foo: 'bar'
	}
	
Doesn't start with `?` or `&`
-----------------------------

The function checks if the first letter in the query string is `?`, removing it only as necessary, so the following three strings behave identically:

	$.parseQuery('?&foo=bar');
	$.parseQuery('&foo=bar');
	$.parseQuery('foo=bar');
	
Returning the object:

	{
		foo: 'bar'
	}
	
Keys without values are dropped
-------------------------------

If you have a key without a value, it is not written to the object:

	$.parseQuery('?&foo=bar&baz');
	
Will return the object:

	{
		foo: 'bar'
	}
	
You can change this behavior by providing the *tolerant* option, so empty keys will be set to empty string (`''`:

	$.parseQuery('?&foo=bar&baz', {tolerant: 1});
	
Will return the object:

	{
		baz: '',
		foo: 'bar'
	}
	
License
=======

http://opensource.org/licenses/MIT