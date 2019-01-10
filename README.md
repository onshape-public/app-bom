# **app-bom**
Sample app for Bill of Materials

BOM is a node.js application demonstrating assembly navigation, metadata retrieval and shaded view generation with use of set of rich primary APIs provided by Onshape that allows Partners to interact with Onshape fully cloud based CAD system.

### **Using BOM**
This app requires to be run in a tab of Onshape, an iFrame. In this type of configuration, Onshape will pass documentId, workspaceId and elementId as query params to the frame. These are utilized by the BOM app to give it context of what the active document is within Onshape.

BOM could also be written to run independently of the tab in Onshape. It could connect to Onshape and get a list of documents for the currently logged in user and then allow the user to select which one to work with.


### **Deploying to Heroku**

Make sure you have Node.js and the Heroku Toolbelt installed. You will also need a Heroku account ([signup for free](https://www.heroku.com/)).

Execute the following commands to create a duplicate of a repository; you need to perform both a bare-clone and a mirror-push to an newly-created bare repo (please note that you may want to use SSH instead of HTTPS, depending on your Github settings):

    $ git clone --bare https://github.com/onshape/app-bom.git
       # make a bare clone of the repository

    $ cd app-bom.git
    $ git push --mirror https://github.com/exampleuser/new-respository.git
       # mirror-push to new respository

    $ cd ..
    $ rm -rf app-bom.git
      # remove temporary local repository

##### Deploy your repo on heroku

    $ git clone https://github.com/exampleuser/new-respository.git
    $ cd new-repository
    $ heroku create
    
The output from Heroku should produce the domain name... which will be something like: `https://fathomless-thicket-78154.herokuapp.com/`. We will refer to this url as the environment variable MY_APP_URL.

#### **Creating the App and Store Entry**

To regsister the new app, use the [Developer Portal](https://dev-portal.onshape.com) to create your OAuth Application. Fill all the fields in, make sure to add "Application can read your documents" scope, and make sure to set the URLs to point to your app url correctly as shown here:
    
    Redirect URLs: <MY_APP_URL>/oauthSignin
    iframe URL: <MY_APP_URL>/oauthRedirect
    
Example:
[URL to my screenshot]

Onshape will register the app on Partner server and send back the OAUTH Secret which are required for the next step.

#### **Set Heroku App Environment**

Make changes to code at one place to point the app to the URL Heroku has created:

    file: ./package.json

       .........
       ........
       "repository": {
       "type": "git",
       "url": "<MY_APP_URL>"
       },
       ...........

Push the local repo code along with code changes to heruko

    $ git add package.json
    $ git commit -am "changes to code for callbackURL"
    $ git push heroku master

You will need to set the ID and Secret as environment variables on the server. These are only visible to the app running on the server, which preserves the security of that information.

    $ heroku config:set OAUTH_CLIENT_ID=<ID given by Onshape for this app - available in the dev-portal>
    $ heroku config:set OAUTH_CLIENT_SECRET=<Secret given by Onshape for this app when you make the OAuth app>
    $ heroku config:set OAUTH_CALLBACK_URL=<MY_APP_URL>/oauthRedirect
    $ heroku config:set ONSHAPE_HOST=<MY_APP_URL>
    $ heroku config:set ONSHAPE_PLATFORM=https://cad.onshape.com
    $ heroku config:set ONSHAPE_OAUTH_SERVICE=https://oauth.onshape.com

You can verify that they are set by calling this:

    $ heroku config

You will also need to install RedisTOGO onto your Heroku app:

    $ heroku addons:create redistogo

If you are new to Heroku, it may complain the first time you do this for an app requiring you to add credit card info as a payment source for potential server traffic. Don't worry, you can select the level of service for RedisTOGO and the base level is free (no cost). The payment source is required in case the service is scaled up to handle a large number of users. You do this via www.heroku.com.

Use heroku config again to verify that RedisTOGO is setup. You'll see this in the config.

    REDISTOGO_URL:        redis://redistogo:bb0854dd586250250969a8b0ea4aa695@hammerjaw.redistogo.com:11093/
    
Now your app is ready! Just sign up for the app on the [App Store](https://appstore.onshape.com).


### **Working with Docker**

The repo also includes a Dockerfile, docker-compose.yml and docker-cloud.yml that can be used to build a container with the app and compose that container with
the required Redis service.

#### **Creating the App and Store Entry**

To create the new app, you will need to use the [Developer Portal](https://dev-portal.onshape.com) to create an OAuth app (You will need to provide a domain name for the service hosting your containers) and then create a Store Entry, which will not be visible to the public.  You will then need to subscribe to the app through the [App Store](https://appstore.onshape.com) in order to add it to your documents.  See the Developer Portal [documentation](https://dev-portal.onshape.com/help) for more information.

#### **Set required environment variables when building or deploying containers**
The OAuth app must contain reachable SSL URLs for the deployed container and you must set the OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET environment
variables to the values from the Developer Portal prior to building or deploying the container. Additionally the OAUTH_CALLBACK_URL environment
variable must be set to the publicly reachable URL for the `/oauthRedirect` endpoint.

### **Reference Documentation**
#### ***Heroku***
For more information about using Node.js on Heroku, see these Dev Center articles:

 -  [Getting Started with Node.js on Heroku](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
 -  [Node.js on Heroku](https://devcenter.heroku.com/categories/nodejs)
 -  [Best Practices for Node.js Development](https://devcenter.heroku.com/articles/node-best-practices)

#### ***OAuth***
Onshape uses standard OAuth2.
 - [See the RFC for a detailed description of OAuth](https://tools.ietf.org/html/rfc6749)
 - [Digital Ocean provides a nice tutorial on using OAuth](https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2)

#### **Docker**
 - [Docker documentation](https://docs.docker.com)
