#**app-bom**
Sample app for Bill of Materials

BOM is an node.js application demonstrating assembly navigation, metadata retrieval and shaded view generation with use of set of rich primary APIs provided by Onshape that allows Partners to interact with Onshape fully cloud based CAD system.

####**Using BOM**
Go to your [app preferences](https://partner.dev.onshape.com/). Click the "Create application" within Onshape document. Fill out the form like so:

* **Name**: My BOM app
* **URL**: https://secret-ocean-9124.herokuapp.com/oauthSignin
* **Base HREF**: You can leave this blank

This app requires to be run in a tab of Onshape, an iFrame. In this type of configuration, Onshape will pass documentId, workspaceId and elementId as query params to the frame. These are utilized by the BOM app to give it context of what the active document is within Onshape. 

BOM could also be written to run independently of the tab in Onshape. It could connect to Onshape and get a list of documents for the currently logged in user and then allow the user to select which one to work with.
  

####**Deploying to Heroku**
Make sure you have Node.js and the Heroku Toolbelt installed. You will also need heroku account [signup for free] (https://www.heroku.com/) 

Execute the following commands to create a duplicate of a repository, you need to perform both a bare-clone and a mirror-push:

    $ git clone --bare https://github.com/onshape/app-bom.git
       # make a bare clone of the repository
    
    $ cd app-bom.git
    $ git push --mirror https://github.com/exampleuser/new-respository.git
       # mirror-push to new respository
       
    $ cd ..
    $ rm -rf app-bom.git
      # remove temporary local repository

######deploy your repo on heroku
    $ git clone https://github.com/exampleuser/new-respository.git  
    $ heroku create

Send the URL that Heroku produces for the new app to api-support@onshape.com, Onshape will register the app on Partner server and send back the OAUTH ID/Secret which are required for authentication.

    $ git push heroku master

You will need to set the ID and Secret as environment variables on the server. These are only visible to the app running on the server preserving security of that information.

    $ heroku config:set OAUTH_CLIENT_ID=<ID given by Onshape for this app>
    $ heroku config:set OAUTH_CLIENT_SECRET=<Secret given by Onshape for this app>

You can verify that they are set by calling this:

    $ heroku config

One more step before you can use this app sample with Onshape. It requires RedisTOGO. 

    $ heroku addons:create redistogo

If you are new to Heroku, it may complain the first time you do this for an app requiring you to add credit card info as a payment source for potential server traffic. Don't worry, you can select the level of service for RedisTOGO and the base level is free (no cost). The payment source is required in case the service is scaled up to handle a large number of users. You do this via www.heroku.com.

Use heroku config again to verify that RedisTOGO is setup. You'll see this in the config.

    REDISTOGO_URL:        redis://redistogo:bb0854dd586250250969a8b0ea4aa695@hammerjaw.redistogo.com:11093/
    


#####**Reference Documentation**
######***Heroku***
For more information about using Node.js on Heroku, see these Dev Center articles:

 -  [Getting Started with Node.js on Heroku](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
 -  [Node.js on Heroku](https://devcenter.heroku.com/categories/nodejs)
 -  [Best Practices for Node.js Development](https://devcenter.heroku.com/articles/node-best-practices)
 
######***OAuth***
Onshape uses standard OAuth2. 
 - [See the RFC for a detailed description of OAuth] (https://tools.ietf.org/html/rfc6749) 
 - [Digital Ocean provides a nice tutorial on using OAuth] (https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2)
