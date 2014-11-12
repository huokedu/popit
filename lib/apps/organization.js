"use strict"; 

var generic_document_app      = require('./generic_document'),
    async                     = require('async'),
    mongoose                  = require('mongoose'),
    user                      = require('../authorization');

module.exports = function () {

  var opts = {
    model_name:            'Organization',
    template_dir:          'organization',
    template_object_name:  'organization',
    template_objects_name: 'organizations',
    url_root:              '/organizations',
  };


  var app = generic_document_app(opts);

  app.get(
    '/new',
    function(req,res) {
        var Organization = req.popit.model( opts.model_name );
        res.locals[opts.template_object_name] = new Organization();
        res.render( opts.template_dir + '/new.html' );
    }
  );

  app.param('id', function findPosts(req, res, next) {
    var organization = res.locals[opts.template_object_name];
    organization.find_posts(function(err, posts) {
      res.locals.posts = posts;
      next(err);
    });
  });

  app.get('/:id(*)/edit', user.can('edit instance'), function(req, res, next) {
    res.render(opts.template_dir + '/edit.html');
  });

  // Process organization's memberships
  app.put('/:id(*)', user.can('edit instance'), function(req, res, next) {
    var memberships = req.body.memberships;
    delete req.body.memberships;
    if (!memberships) {
      return next();
    }
    var Person = req.db.model('Person');
    var Membership = req.db.model('Membership');

    var updateMembership = function(membership, done) {
      Membership.findById(membership.id, function(err, doc) {
        if (err) {
          return done(err);
        }
        if (!doc) {
          var objectId = new mongoose.Types.ObjectId();
          doc = new Membership({_id: objectId.toHexString()});
        }
        doc.set(membership);
        doc.save(done);
      });
    };

    async.forEachSeries(memberships, function(membership, done) {
      Person.findById(membership.person_id, function(err, person) {
        if (err) {
          return done(err);
        }
        // Create person if they doesn't exist
        if (!person) {
          var objectId = new mongoose.Types.ObjectId();
          person = new Person({_id: objectId.toHexString(), name: membership.person_name});
          membership.person_id = person._id;
          delete membership.person_name;
          person.save(function(err) {
            if (err) {
              return done(err);
            }

            updateMembership(membership, done);
          });
        } else {
          delete membership.person_name;
          updateMembership(membership, done);
        }

      });
    }, next);
  });


  // Save changes to organization model
  app.put('/:id(*)', user.can('edit instance'), function(req, res, next) {
    var Organization = req.db.model('Organization');
    Organization.findById(req.param('id'), function(err, organization) {
      if (err) {
        return next(err);
      }
      organization.set(req.body);
      organization.save(function(err, organization) {
        if (err) {
          return next(err);
        }
        // there is a bug that means we sometimes failed to create the id
        // key so fallback to _id if that's the case
        var id = organization.id ? organization.id : organization._id;
        res.redirect('/organizations/' + id );
      });
    });
  });

  return app;
};
