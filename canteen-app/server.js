const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db/connection');
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

let carts = {}; // in-memory cart storage per customer

// LOGIN PAGE
app.get('/', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM users WHERE username=? AND password=?';
  db.query(sql, [username, password], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      const role = results[0].role;
      if (role === 'admin') res.redirect('/admin');
      else res.redirect(`/customer/${results[0].id}`);
    } else res.render("invalid_credentials");

  });
});

// ADMIN DASHBOARD
app.get('/admin', (req, res) => {
  res.render('admin_dashboard');
});

// ADMIN ITEMS PAGE
app.get('/admin/items', (req, res) => {
  db.query('SELECT * FROM items', (err, items) => {
    if (err) throw err;
    res.render('admin_items', { items });
  });
});

app.post('/admin/items/add', (req, res) => {
  const { name, price, prep_time } = req.body;
  const sql = 'INSERT INTO items (name, price, prep_time) VALUES (?, ?, ?)';
  db.query(sql, [name, price, prep_time], () => res.redirect('/admin/items'));
});

app.post('/admin/items/delete/:id', (req, res) => {
  db.query('DELETE FROM items WHERE id=?', [req.params.id], () => res.redirect('/admin/items'));
});

// ADMIN ORDERS PAGE
app.get('/admin/orders', (req, res) => {
  db.query('SELECT * FROM orders', (err, orders) => {
    if (err) throw err;
    res.render('admin_orders', { orders });
  });
});

// CUSTOMER MENU
app.get('/customer/:id', (req, res) => {
  const customerId = req.params.id;
  db.query('SELECT * FROM items', (err, items) => {
    if (err) throw err;
    if (!carts[customerId]) carts[customerId] = {};
    res.render('customer_menu', { customerId, items, cartCount: Object.keys(carts[customerId]).length });
  });
});

//ADD TO CART
app.post('/customer/:id/cart/add', (req, res) => {
  const { itemId, name, price } = req.body;
  const customerId = req.params.id;
  if (!carts[customerId]) carts[customerId] = {};
  if (carts[customerId][itemId]) carts[customerId][itemId].qty++;
  else carts[customerId][itemId] = { name, price: parseFloat(price), qty: 1 };
  res.redirect(`/customer/${customerId}`);
})

// VIEW CART
app.get('/customer/:id/cart', (req, res) => {
  const customerId = req.params.id;
  const cart = carts[customerId] || {};
  let subtotal = 0;
  Object.values(cart).forEach(i => subtotal += i.price * i.qty);
  res.render('customer_cart', { customerId, cart, subtotal });
});

//CART MODIFICATIONS
// Increase quantity
app.post('/customer/:customerId/cart/increase', (req, res) => {
  const { customerId } = req.params;
  const { itemId } = req.body;
  const cart = carts[customerId] || {};

  if (cart[itemId]) {
    cart[itemId].qty += 1;
  }
  carts[customerId] = cart;
  res.redirect(`/customer/${customerId}/cart`);
});

// Decrease quantity
app.post('/customer/:customerId/cart/decrease', (req, res) => {
  const { customerId } = req.params;
  const { itemId } = req.body;
  const cart = carts[customerId] || {};

  if (cart[itemId]) {
    cart[itemId].qty -= 1;
    if (cart[itemId].qty <= 0) delete cart[itemId];
  }
  carts[customerId] = cart;
  res.redirect(`/customer/${customerId}/cart`);
});

// Remove item completely
app.post('/customer/:customerId/cart/remove', (req, res) => {
  const { customerId } = req.params;
  const { itemId } = req.body;
  const cart = carts[customerId] || {};

  delete cart[itemId];
  carts[customerId] = cart;
  res.redirect(`/customer/${customerId}/cart`);
});


// PROCEED TO PAYMENT
app.post('/customer/:id/cart/confirm', (req, res) => {
  const customerId = req.params.id;
  const cart = carts[customerId] || {};
  let subtotal = 0;
  Object.values(cart).forEach(i => subtotal += i.price * i.qty);
  res.render('customer_payment', { customerId, cart, subtotal });
});

// PLACE ORDER (simulate payment done)
app.post('/customer/:id/place-order', (req, res) => {
  const customerId = req.params.id;
  const cart = carts[customerId];
  if (!cart) return res.send('Cart empty!');

  const items = Object.values(cart).map(i => `${i.name} x${i.qty}`).join(', ');
  let total = 0, prep_time = 0;
  Object.values(cart).forEach(i => total += i.price * i.qty);
  prep_time = 10 + Object.keys(cart).length * 2; // simple formula

  const sql = 'INSERT INTO orders (customer_id, items, total, prep_time) VALUES (?, ?, ?, ?)';
  db.query(sql, [customerId, items, total, prep_time], (err) => {
    if (err) throw err;
    carts[customerId] = {}; // clear cart
    res.send(`<h2>Order placed successfully!</h2><a href="/customer/${customerId}">Back to Menu</a>`);
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('MySQL Connected!');
});

//CONFIRM ORDER
app.post('/confirm-order', (req, res) => {
  const { customerId, items, totalPrice } = req.body;

  const sql = 'INSERT INTO orders (customer_id, items, total_price) VALUES (?, ?, ?)';
  db.query(sql, [customerId, JSON.stringify(items), totalPrice], (err, result) => {
    if (err) throw err;
    res.redirect('/payment');
  });
});

//DISPLAY ORDER TO ADM
app.get('/admin/orders', (req, res) => {
  const sql = 'SELECT * FROM orders ORDER BY order_time DESC';
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.render('admin_orders', { orders: results });
  });
});


//BACK TO LOGIN
app.get('/login', (req, res) => {
  res.render('login'); // this renders views/login.ejs
});