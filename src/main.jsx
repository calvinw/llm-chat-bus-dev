import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ChatApp from './ChatApp.jsx';

function App() {
    return <ChatApp />;
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);