#**app-bom**
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
    $ git push --mirror https://github.com/<exampleuser>/new-respository.git
       # mirror-push to new respository

    $ cd ..
    $ rm -rf app-bom.git
      # remove temporary local repository

##### Deploy your repo on heroku

    $ git clone https://github.com/<exampleuser>/new-respository.git
    $ cd new-repository
    $ heroku create

#### **Creating the App and Store Entry**

To regsister the new app, use the [Developer Portal](https://dev-portal.onshape.com) to create your OAuth Application and private Store Entry, which you can then subscribe to in the [App Store](https://appstore.onshape.com) in order to add it to your documents. The output from Heroku should produce the domain name:

    Application name (ex: Onshape BOM Sample)
    Application description (one sentence; ex: "Onshape BOM Sample application — source code is available.")
    URL for sign-in (ex: onshape-app-bom.herokuapp.com/oauthSignin)
    URL for redirect (ex: onshape-app-bom.herokuapp.com/oauthRedirect)
    Requested Format ID (ex: Onshape-Demo/BOM)

Onshape will register the app on Partner server and send back the OAUTH ID/Secret which are required for authentication.

Make changes to code at two places for the new URL that Heroku has produced, as shown below:

    file# 1: ./package.json

       .........
       ........
       "repository": {
       "type": "git",
       "url": "https://<newURL-from-heroku>.herokuapp.com/"
       },
       ...........

   And

    file# 2: ./authentication.js

        ...........
       passport.use(new OnshapeStrategy({
         clientID: oauthClientId,
         clientSecret: oauthClientSecret,
         callbackURL: "https://<newURL-from-heroku>.herokuapp.com/oauthRedirect",
         .............
       },
       function(accessToken, refreshToken, profile, done) {
         ...........

Push the local repo code along with code changes to heruko

    $ git add package.json
    $ git add authentication.js
    $ git commit -am "changes to code for callbackURL"

    $ git push heroku master

You will need to set the ID and Secret as environment variables on the server. These are only visible to the app running on the server preserving security of that information.

    $ heroku config:set OAUTH_CLIENT_ID=<ID given by Onshape for this app>
    $ heroku config:set OAUTH_CLIENT_SECRET=<Secret given by Onshape for this app>
    $ heroku config:set OAUTH_CALLBACK_URL=<https://newURL-from-heroku.herokuapp.com>

You will also need to register your server host, the stack url (for example ONSHAPE_PLATFORM=https://cad.onshape.com), and the Onshape authentication URL.

    $ heroku config:set ONSHAPE_HOST=https://<newURL-from-heroku>.herokuapp.com
    $ heroku config:set ONSHAPE_PLATFORM=https://STACK.onshape.com
    $ heroku config:set ONSHAPE_OAUTH_SERVICE=https://oauth.onshape.com

You can verify that they are set by calling this:

    $ heroku config

Other required environment variables that must be set include:

    ONSHAPE_PLATFORM: should be "https://cad.onshape.com"
    ONSHAPE_HOST: should be your hostname from Heroku, e.g. "https://<newURL-from-heroku>.herokuapp.com"
    ONSHAPE_OAUTH_SERVICE: should be "https://oauth.onshape.com"

One more step before you can use this app sample with Onshape. It requires RedisTOGO.

    $ heroku addons:create redistogo

If you are new to Heroku, it may complain the first time you do this for an app requiring you to add credit card info as a payment source for potential server traffic. Don't worry, you can select the level of service for RedisTOGO and the base level is free (no cost). The payment source is required in case the service is scaled up to handle a large number of users. You do this via www.heroku.com.

Use heroku config again to verify that RedisTOGO is setup. You'll see this in the config.

    REDISTOGO_URL:        redis://redistogo:bb0854dd586250250969a8b0ea4aa695@hammerjaw.redistogo.com:11093/

### **Working with Docker**

The repo also includes a Dockerfile, docker-compose.yml and docker-cloud.yml that can be used to build a container with the app and compose that container with
the required Redis service.

#### **Creating the App and Store Entry**

To create the new app, you will need to use the [Developer Portal](https://dev-portal.onshape.com) to create an OAuth app (You will need to provide a domain name for the service hosting your containers). To specify a tab-based extension, click on the “Extensions” tab and “Add Extension”.

    - Name: `<Enter extension name>`
	- Description(Optional): `<Enter extension description>`
	- Location: `Element Tab`
	- Action URL: `https://<newURL-from-heroku.herokuapp.com>` 
	- Icon(Optional): `<Drop an image to upload>`
Then create a Store Entry, which will not be visible to the public.  You will then need to subscribe to the app through the [App Store](https://appstore.onshape.com) in order to add it to your documents.  See the Developer Portal [documentation](https://dev-portal.onshape.com/help) for more information.

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
