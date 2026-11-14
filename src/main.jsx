import React from 'react';
import { createRoot } from 'react-dom/client';

// Bootstrap & Bootstrap Icons styles
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// RoomTrail Design System Tokens & Modular Styles
import './styles/variables.css';
import './styles/custom.css';
import './styles/layout.css';
import './styles/places.css';
import './styles/tracking.css';
import './styles/landing.css';
import './index.css';

import App from './App.jsx';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
