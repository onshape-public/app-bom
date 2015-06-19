#**app-bom**
Sample app for Bill of Materials

BOM is an node.js application demonstrating assembly navigation, metadata retrieval and shaded view generation with use of set of rich primary APIs provided by Onshape that allows Partners to interact with Onshape fully cloud based CAD system.

####**Using BOM**
Go to your [app preferences](https://partner.dev.onshape.com/). Click the "Create application" within Onshape document. Fill out the form like so:

* **Name**: My BOM app
* **URL**: https://secret-ocean-9124.herokuapp.com/oauthSignin
* **Base HREF**: You can leave this blank

Currently this sample app has set and deployed in a way that when app is created Onshape sends request to app server with the required document id, workspace id and element id as queryparam. In other case (not supported in this version), it can also be implementation in a way that sends request to Onshape for getting list of documents/ elements/parts and then user can pick from list to view said data.  

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
    $ git push heroku master

Send the URL to api-support@onshape.com, Onshape will register the app on Partner server and send back the ID/Secret 


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
