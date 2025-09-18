import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './ui/App.jsx'
import Login from './ui/Login.jsx'
import AdminLogin from './ui/AdminLogin.jsx'
import AdminPanel from './ui/AdminPanel.jsx'
import AdminUsers from './ui/AdminUsers.jsx'
import './ui/base.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/admin/login" element={<AdminLogin/>} />
        <Route path="/admin" element={<AdminPanel/>} />
        <Route path="/admin/users" element={<AdminUsers/>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
