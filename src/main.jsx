import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Import CSS style files to load our theme variables and layouts
import '../style.css';
import '../css/core.css';
import '../css/animations.css';
import '../css/outside.css';
import '../css/curtain.css';
import '../css/booth.css';
import '../css/inside.css';
import '../css/controls.css';
import '../css/printer.css';
import '../css/theme-japanese-light.css';
import '../css/toggle.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
