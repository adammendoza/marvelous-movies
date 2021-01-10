const express = require('express');
const csrf = require('csurf');
const bcrypt = require('bcryptjs');
const {check, validationResult} = require('express-validator'); 

const {User} = require('../db/models')
const {loginUser, logoutUser } = require('../auth');
const db = require('../db/models');

const router = express.Router();
const csrfProtection = csrf({ cookie: true });

const asyncHandler = (handler) => (req, res, next) => handler(req, res, next).catch(next);

const userValidators = [
  csrfProtection,
  check('userName')
    .exists({checkFalsy:true})
    .withMessage('Please provide a value for user name')
    .isLength({ max: 50 })
    .withMessage('User Name must not be more than 50 characters long')
    .custom((value) => {
      return User.findOne({ where: { userName: value } })
        .then((user) => {
          if (user) {
            return Promise.reject('The provided Username is already in use by another account');
          }
        });
    }),
  check('firstName')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for First Name')
    .isLength({ max: 50 })
    .withMessage('First Name must not be more than 50 characters long'),
  check('lastName')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for Last Name')
    .isLength({ max: 50 })
    .withMessage('Last Name must not be more than 50 characters long'),
  check('email')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for Email Address')
    .isLength({ max: 100 })
    .withMessage('Email Address must not be more than 100 characters long')
    .isEmail()
    .withMessage('Email Address is not a valid email')
    .custom((value) => {
      return User.findOne({ where: { email: value } })
        .then((user) => {
          if (user) {
            return Promise.reject('The provided Email Address is already in use by another account');
          }
        });
    }),
  check('bio')
    .isLength({max: 255})
    .withMessage('Bio must not be more than 255 characters long'),
  check('password')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for Password')
    .isLength({ max: 50 })
    .withMessage('Password must not be more than 50 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/, 'g')
    .withMessage('Password must contain at least 1 lowercase letter, uppercase letter, and number'),
  check('confirmPassword')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for Confirm Password')
    .isLength({ max: 50 })
    .withMessage('Confirm Password must not be more than 50 characters long')
    .custom((value, {req}) => {
      if(value !== req.body.password) {
        throw new Error('Passwords do not match ');
      }
      return true;
    }),
];

router.get('/sign_up', csrfProtection, asyncHandler(async (req, res) => {
  const user = User.build();
  res.render('sign-up', { user, token: req.csrfToken() })
}));


router.post('/sign_up', userValidators, asyncHandler(async (req, res, next) => {
  const { userName, firstName, lastName, email, bio, password } = req.body;
  
  const user =  User.build({ userName, firstName, lastName, email, bio});
  
  const validatorErrors = validationResult(req);
  
  if (validatorErrors.isEmpty()) {
    const hashedPassword = await bcrypt.hash(password, 10);
    user.hashedPassword = hashedPassword;
    await user.save();
    loginUser(req, res, user)
    
    return req.session.save(err =>{
      if (err){
        next(err)
      } else {
        return res.redirect('/')
      }
    })
    
  } else {
    const errors = validatorErrors.array().map((error) => error.msg);
    res.render('sign-up', {
      title:'Sign Up',
      user,
      errors,
      token: req.csrfToken()
    })
  }
}));

const loginValidators = [
  csrfProtection,
  check('email')
  .exists({ checkFalsy: true })
  .withMessage('Please provide a value for Email Address'),
  check('password')
  .exists({ checkFalsy: true })
  .withMessage('Please provide a value for Password'),
];

router.get('/login', csrfProtection, asyncHandler(async (req, res) => {
  res.render('login', { token: req.csrfToken() });
}));

router.post('/login', loginValidators, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  let errors = [];
  const validatorErrors = validationResult(req);

  if(validatorErrors.isEmpty()){
    const user = await User.findOne({ where: { email } });

    if(user !== null) {
      const isPassword = await bcrypt.compare(password, user.hashedPassword.toString());

      
      if (isPassword) {
        loginUser(req,res,user)
        return req.session.save(err => {
          if (err) {
            next(err)
          } else {
            return res.redirect('/')
          }
        })
      } 
    } 
    errors.push('Login failed for the provided email address and password');
  }
    else {
      errors = validatorErrors.array().map((error) => error.msg);
    }

    res.render('login', {
      title: 'Login',
      email,
      errors,
      token: req.csrfToken(),
    });
    
      
}));

router.post('/logout', (req, res)=>{
  logoutUser(req, res);
  return req.session.save(err => {
    if (err) {
      next(err)
    } else {
      return res.redirect('/')
    }
  })
  
});
router.post(
  "/demo",
  asyncHandler(async (req, res) => {
    const users = await User.findOne({
      where:{email:"demouser@demoUser.com"}
     
    })
    loginUser(req,res,users)
    return req.session.save((err) => {
      if (err) {
        next(err);
      } else {
        return res.redirect("/");
      }
    });
  })
);

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond ith a resource');
});

// router.get(
//   "/:id(\\d+)",
//   asyncHandler(async (req, res) => {
//     const currentUser = req.params.id;
//     const movies = await db.BlockbusterShelf.findAll({
//       where:{userId: currentUser},
//       include: {
//         model: db.Movie,
//       },   
//     });
//     const users = await db.User.findByPk(currentUser)
//     const joined = users.createdAt.getFullYear()
//      res.render("profile", {users,joined, movies});
//     //res.json({movies,users})   
//   })
// );
//while above code works this will allow anyone with the link to view the user profile

router.get(
  "/:id(\\d+)",
  asyncHandler(async (req, res) => {
    const currentUser = req.session.auth.userId;
    const users = await db.User.findByPk(currentUser, {
      include: {
        model: db.Movie,
        limit:5
      },
    });
    
    const joined = users.createdAt.getFullYear();
    res.render("profile", { users, joined});
    //res.json({users})
  })
);
router.get(
  "/:id(\\d+)/shelves",
  asyncHandler(async (req, res) => {
    const currentUser = req.session.auth.userId;
    const users = await db.User.findByPk(currentUser, {
      include: {
        model: db.Movie,
      },
    });
    res.render("shelf", { users, joined });
   
  })
);

router.get(
  "/:id(\\d+)/shelves/watched",
  asyncHandler(async (req, res) => {
    const currentUser = req.session.auth.userId;
    const users = await db.User.findByPk(currentUser, {
      include: {
        model: db.Movie,
        }
    });
    res.render("watched", { users});
  })
);

router.get(
  "/:id(\\d+)/shelves/wantToWatch",
  asyncHandler(async (req, res) => {
    const currentUser = req.session.auth.userId;
    const users = await db.User.findByPk(currentUser, {
      include: {
        model: db.Movie,
      },
    });
    res.render("wantToWatch", { users });
  })
);

router.get(
  "/:id(\\d+)/shelves/currentlyWatching",
  asyncHandler(async (req, res) => {
    const currentUser = req.session.auth.userId;
    const users = await db.User.findByPk(currentUser, {
      include: {
        model: db.Movie,
      },
    });
    res.render("currentlyWatching", { users });
  })
);







module.exports = router;