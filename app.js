const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
const dotenv = require('dotenv');
dotenv.config({ path: './env/.env' });
app.use('/resource', express.static('public'));
app.use('/resource', express.static(__dirname + '/public'))
app.set('view engine', 'ejs');
const bcryptjs = require('bcryptjs');
const session = require('express-session');
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
const connection = require('./database/db');
app.get('/login', (req, res) => {
    res.render('login');
})
app.get('/register', (req, res) => {
    res.render('register');
})
app.post('/register', async (req, res) => {
    const user = req.body.user;
    const name = req.body.name;
    const rol = req.body.rol;
    const pass = req.body.pass;
        // Verificar si el usuario ya existe
        connection.query('SELECT * FROM users WHERE user = ?', [user], async (error, results) => {
            if (error) {
                console.log(error);
            } else if (results.length > 0) {
                // Si el usuario ya existe, enviar una alerta
                res.render('register', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "El usuario ya está en uso.",
                    alertIcon: "error",
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            } else {
                // Si el usuario no existe, proceder con la inserción
                let passwordHaash = await bcryptjs.hash(pass, 8);
                connection.query('INSERT INTO users SET ?', { user: user, name: name, rol: rol, pass: passwordHaash }, (error, results) => {
                    if (error) {
                        console.log(error);
                    } else {
                        res.render('register', {
                            alert: true,
                            alertTitle: "Registration",
                            alertMessage: "¡Registro exitoso!",
                            alertIcon: "success",
                            showConfirmButton: false,
                            timer: 1500,
                            ruta: ''
                        });
                    }
                });
            }
        });
    });
    app.post('/auth', async (req, res) => {
        const user = req.body.user;
        const pass = req.body.pass;
        let passwordHash = await bcryptjs.hash(pass, 8);
        
        if (user && pass) {
            connection.query('SELECT * FROM users WHERE user = ?', [user], async (error, results) => {
                if (results.length == 0 || !(await bcryptjs.compare(pass, results[0].pass))) {
                    res.render('login', {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage: 'Usuario y/o password incorrectas',
                        alertIcon: 'error',
                        showConfirmButton: true,
                        timer: false,
                        ruta: 'login'
                    });
                } else {
                    req.session.loggedin = true;
                    req.session.name = results[0].name;
                    req.session.rol = results[0].rol;  // Asegúrate de almacenar el rol en la sesión
    
                    // Redirigir según el rol del usuario
                    if (results[0].rol === 'aseguradora') {
                        res.render('login', {
                            alert: true,
                            alertTitle: "Conexión exitosa",
                            alertMessage: '¡Login Correcto!',
                            alertIcon: 'success',
                            showConfirmButton: false,
                            timer: 1500,
                            ruta: 'create-order'
                        });
                    } else {
                        res.render('login', {
                            alert: true,
                            alertTitle: "Conexión exitosa",
                            alertMessage: '¡Login Correcto!',
                            alertIcon: 'success',
                            showConfirmButton: false,
                            timer: 1500,
                            ruta: ''
                        });
                    }
                }
            });
        } else {
            res.render('login', {
                alert: true,
                alertTitle: "Advertencia",
                alertMessage: 'Por favor ingrese un usuario y/o password!',
                alertIcon: 'warning',
                showConfirmButton: true,
                timer: 1500,
                ruta: 'login'
            });
        }
    });
app.get('/', (req, res) => {
    if (req.session.loggedin) {
        res.render('index', {
            login: true,
            name: req.session.name
        });
    } else {
        res.render('index', {
            login: false,
            name: 'Debe iniciar sesión',
        });
    }
    res.end();
});
app.get('/logout', (req,res)=>{
    req.session.destroy(()=>{
        res.redirect('/')
    })
})


////////////////////
app.get('/create-order', (req, res) => {
    if (req.session.loggedin && req.session.rol === 'aseguradora') {
        res.render('create-order', { login: true, name: req.session.name });
    } else {
        res.redirect('/login');  // Redirige a login si no tiene acceso
    }
});

app.post('/create-order', (req, res) => {
    const { user, workshop_type, description, brand, model, year, chassis_number, license_plate, color, owner_name, owner_phone } = req.body;

    const queryUser = "SELECT user_id FROM users WHERE user = ?";
    connection.query(queryUser, [user], (err, result) => {
        if (err || result.length === 0) {
            console.log(err);  // Depuración
            res.render('create-order', {
                alertTitle: "Error",
                alertMessage: "Taller no encontrado.",
                alertIcon: "error",
                showConfirmButton: true,
                timer: false
            });
        } else {
            const user_id = result[0].user_id;

            const queryOrder = "INSERT INTO work_orders (user_id, workshop_type, description) VALUES (?, ?, ?)";
            connection.query(queryOrder, [user_id, workshop_type, description], (err, result) => {
                if (err) {
                    console.log(err);  // Depuración
                    res.render('create-order', {
                        alertTitle: "Error",
                        alertMessage: "Error al crear la orden.",
                        alertIcon: "error",
                        showConfirmButton: true,
                        timer: false
                    });
                } else {
                    const work_order_id = result.insertId;

                    const queryCar = "INSERT INTO cars (work_order_id, brand, model, year, chassis_number, license_plate, color, owner_name, owner_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    connection.query(queryCar, [work_order_id, brand, model, year, chassis_number, license_plate, color, owner_name, owner_phone], (err, result) => {
                        if (err) {
                            console.log(err);  // Depuración
                            res.render('create-order', {
                                alertTitle: "Error",
                                alertMessage: "Error al registrar el vehículo.",
                                alertIcon: "error",
                                showConfirmButton: true,
                                timer: false
                            });
                        } else {
                            res.render('create-order', {
                                alertTitle: "Éxito",
                                alertMessage: "Orden creada exitosamente.",
                                alertIcon: "success",
                                showConfirmButton: false,
                                timer: 1500
                            });
                        }
                    });
                }
            });
        }
    });
});



app.listen(3000, (req, res) => {
    console.log('SERVER RUNNING IN http://localhost:3000');
})