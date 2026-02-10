// Configuration for Workflows
// Base de webhooks de n8n (PRODUCTION URL, no el -test)
const N8N_WEBHOOK_BASE = 'https://n8n.clockinapp.lat/webhook-test';

const WORKFLOWS = [
    {
        id: 'attendance-report',
        name: 'Reporte de asistencias',
        icon: 'fa-solid fa-clipboard-user',
        colorClass: 'text-blue',
        description: 'Genera un reporte a partir del archivo de asistencias subido.',
        uploadEndpoint: `${N8N_WEBHOOK_BASE}/attendance-report/upload`,
        resultEndpoint: null,
        returnsFile: false,
        returnsUrl: true,   // devuelve link
        multiple: false    // solo un archivo
    },
    {
        id: 'po-classifier',
        name: 'Clasificador órdenes de compra',
        icon: 'fa-solid fa-file-invoice-dollar',
        colorClass: 'text-green',
        description: 'Clasifica órdenes de compra a partir del archivo cargado.',
        uploadEndpoint: `${N8N_WEBHOOK_BASE}/po-classifier/upload`,
        returnsFile: false,
        returnsUrl: true,
        multiple: true      // permite múltiples archivos
    },
    {
        id: 'ex-notas',
        name: 'Extractor de Notas',
        icon: 'fa-solid fa-note-sticky',
        colorClass: 'text-yellow',
        description: 'Clasificador alterno, solo sube el archivo a la carpeta de la empresa.',
        uploadEndpoint: `${N8N_WEBHOOK_BASE}/ex-notas/upload`,
        resultEndpoint: null,
        returnsFile: false,
        returnsUrl: true,
        multiple: false     // si luego quieres múltiples aquí, cambia a true
    },

    {
        id: 'po-classifier-secondary',
        name: 'Clasificador órdenes de compra de Secundary',
        icon: 'fa-solid fa-file-invoice',
        colorClass: 'text-orange',
        description: 'Clasificador alterno, solo sube el archivo a la carpeta de la empresa.',
        uploadEndpoint: `${N8N_WEBHOOK_BASE}/po-classifier-secondary/upload`,
        resultEndpoint: null,
        returnsFile: false,
        returnsUrl: true,
        multiple: true    // si luego quieres múltiples aquí, cambia a true
    }
];

// State
let currentWorkflow = null;
let currentUser = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');
const workflowList = document.getElementById('workflow-list');
const workflowContent = document.getElementById('workflow-content');
const emptyState = document.getElementById('empty-state');
const wfTitle = document.getElementById('wf-title');
const wfDescription = document.getElementById('wf-description');
const fileUpload = document.getElementById('file-upload');
const runWorkflowBtn = document.getElementById('run-workflow-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const statusArea = document.getElementById('status-area');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    renderWorkflows();
});

// Authentication Logic
async function checkSession() {
    try {
        const res = await fetch('../api/user.php');
        const data = await res.json();
        if (data.user) {
            showApp(data.user);
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('../api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            showApp(data.user);
            loginError.classList.add('d-none');
        } else {
            loginError.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.classList.remove('d-none');
    }
});

logoutBtn.addEventListener('click', async () => {
    await fetch('../api/logout.php', { method: 'POST' });
    showLogin();
});

function showApp(user) {
    currentUser = user;
    userDisplay.textContent = user;
    loginSection.classList.add('d-none');
    appSection.classList.remove('d-none');
}

function showLogin() {
    currentUser = null;
    loginSection.classList.remove('d-none');
    appSection.classList.add('d-none');
    loginForm.reset();
}

// Workflow Logic
function renderWorkflows() {
    workflowList.innerHTML = '';
    WORKFLOWS.forEach(wf => {
        const btn = document.createElement('button');
        btn.className = 'list-group-item list-group-item-action';
        btn.innerHTML = `<i class="${wf.icon} ${wf.colorClass} me-3 fs-5"></i> ${wf.name}`;
        btn.onclick = () => selectWorkflow(wf, btn);
        workflowList.appendChild(btn);
    });
}

function selectWorkflow(wf, btnElement) {
    currentWorkflow = wf;

    // Update UI active state
    document.querySelectorAll('.list-group-item').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    // Show content
    emptyState.classList.add('d-none');
    workflowContent.classList.remove('d-none');

    // Update content details
    wfTitle.textContent = wf.name;
    wfDescription.textContent = wf.description;

    // Reset inputs
    fileUpload.value = '';
    statusArea.innerHTML = '';
    resetButton();
}

runWorkflowBtn.addEventListener('click', async () => {
    if (!currentWorkflow) return;

    const files = Array.from(fileUpload.files);   // 🔹 TOMAMOS TODOS LOS ARCHIVOS

    if (!files.length) {
        alert('Por favor selecciona al menos un archivo primero.');
        return;
    }

    setLoading(true);
    statusArea.innerHTML = '<div class="alert alert-info">Procesando archivo(s)...</div>';

    try {
        await uploadFile(currentWorkflow, files);
    } catch (error) {
        console.error(error);
        statusArea.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading) {
    runWorkflowBtn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = 'Procesando...';
        btnSpinner.classList.remove('d-none');
    } else {
        btnText.textContent = 'Ejecutar workflow';
        btnSpinner.classList.add('d-none');
    }
}

function resetButton() {
    runWorkflowBtn.disabled = false;
    btnText.textContent = 'Ejecutar workflow';
    btnSpinner.classList.add('d-none');
}

// API Interactions
async function uploadFile(workflowConfig, files) {
    const formData = new FormData();

    if (workflowConfig.multiple) {
        // 🔹 Enviamos cada archivo con nombre único: file0, file1, ...
        files.forEach((file, index) => {
            formData.append(`file${index}`, file, file.name);
        });
    } else {
        // 🔹 Flujo tradicional de un solo archivo (attendance-report, etc.)
        const file = files[0];
        formData.append('file', file, file.name);
    }

    const response = await fetch(workflowConfig.uploadEndpoint, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('Respuesta n8n (error):', text);
        throw new Error('Error al subir archivo a n8n');
    }

    // 👉 Si este workflow devuelve una URL (JSON con { driveUrl } / { Excel_Url } etc.)
    if (workflowConfig.returnsUrl) {
        let data;
        try {
            data = await response.json();
        } catch (e) {
            const text = await response.text().catch(() => '');
            console.error('Respuesta no JSON de n8n:', text);
            throw new Error('La respuesta de n8n no es JSON válido');
        }

        // ✅ Detectar qué campo trae la URL y adaptar el texto del botón
        const candidates = [
            { key: 'driveUrl', label: 'Abrir reporte en Drive' },
            { key: 'Excel_Url', label: 'Abrir reporte en Excel' },
            { key: 'url', label: 'Abrir reporte' },
            { key: 'webViewLink', label: 'Abrir reporte' }
        ];

        const found = candidates.find(c => data && data[c.key]);

        if (!found) {
            console.warn('Respuesta de n8n no trae URL conocida:', data);
            statusArea.innerHTML = `
                <div class="alert alert-warning">
                    El workflow terminó pero no se recibió la URL del reporte.<br>
                    Revisa el nodo "Respond to Webhook" en n8n.
                </div>
            `;
            return;
        }

        const url = data[found.key];

        statusArea.innerHTML = `
            <div class="alert alert-success">
                <p class="mb-2">¡Reporte generado correctamente!</p>
                <a href="${url}" target="_blank" rel="noopener" class="btn btn-success btn-sm">
                    ${found.label}
                </a>
            </div>
        `;
        return;
    }

    // 👉 Lógica existente para los demás workflows
    if (workflowConfig.returnsFile && workflowConfig.resultEndpoint) {
        await fetchResult(workflowConfig);
    } else {
        statusArea.innerHTML = '<div class="alert alert-success">Archivo(s) subido(s) correctamente. El workflow se encarga del resto.</div>';
    }
}

async function fetchResult(workflowConfig) {
    statusArea.innerHTML = '<div class="alert alert-info">Obteniendo resultado...</div>';

    const response = await fetch(workflowConfig.resultEndpoint);

    if (!response.ok) {
        throw new Error('Error al obtener el resultado de n8n');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    statusArea.innerHTML = `
        <div class="alert alert-success">
            <p class="mb-2">¡Proceso completado con éxito!</p>
            <a href="${url}" download="resultado_${workflowConfig.id}" class="btn btn-success btn-sm">
                Descargar resultado
            </a>
        </div>
    `;
}
