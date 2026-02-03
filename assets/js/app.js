// =========================
// ESTADO DA APLICAÇÃO
// =========================
let appointments = JSON.parse(localStorage.getItem('birth_appointments')) || [];
appointments = appointments.filter(app => app && app.id && app.date);
localStorage.setItem('birth_appointments', JSON.stringify(appointments));

let currentDate = new Date();
let selectedDoctor = null;
let currentAppointment = null;

// =========================
// ELEMENTOS DOM
// =========================
const patientNameInput = document.getElementById('patient-name');
const patientPhoneInput = document.getElementById('patient-phone');
const birthTypeSelect = document.getElementById('birth-type');
const birthDateInput = document.getElementById('birth-date');
const birthTimeInput = document.getElementById('birth-time');
const notesInput = document.getElementById('notes');
const btnSchedule = document.getElementById('btn-schedule');
const doctorOptions = document.querySelectorAll('.doctor-option');
const alertContainer = document.getElementById('alert-container');
const calendarElement = document.getElementById('calendar');
const currentMonthElement = document.getElementById('current-month');
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');
const confirmationModal = document.getElementById('confirmation-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnConfirmAppointment = document.getElementById('btn-confirm-appointment');
const btnCancelAppointment = document.getElementById('btn-cancel-appointment');
const modalDetails = document.getElementById('modal-details');

// =========================
// CONFIGURAÇÕES INICIAIS
// =========================
const today = new Date();
const formattedToday = today.toISOString().split('T')[0];
birthDateInput.min = formattedToday;
birthTimeInput.value = '08:00';

// =========================
// EVENTOS
// =========================
doctorOptions.forEach(option => {
    option.addEventListener('click', () => {
        doctorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedDoctor = option.dataset.doctor;
        validateForm();
    });
});

btnSchedule.addEventListener('click', scheduleAppointment);

btnPrevMonth.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
};

btnNextMonth.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
};

btnCloseModal.onclick = () => confirmationModal.style.display = 'none';
btnCancelAppointment.onclick = () => confirmationModal.style.display = 'none';

[patientNameInput, patientPhoneInput, birthDateInput, birthTimeInput].forEach(input =>
    input.addEventListener('input', validateForm)
);

// =========================
// FUNÇÕES
// =========================
function validateForm() {
    btnSchedule.disabled = !(
        patientNameInput.value.trim() &&
        patientPhoneInput.value.trim() &&
        birthDateInput.value &&
        birthTimeInput.value &&
        selectedDoctor
    );
}

function scheduleAppointment() {
    if (!validateForm()) return;

    const appointmentDate = new Date(`${birthDateInput.value}T${birthTimeInput.value}`);
    if (appointmentDate < new Date()) {
        showAlert('Não é possível agendar para datas passadas!', 'error');
        return;
    }

    if (checkForConflicts(selectedDoctor, appointmentDate, null).length) {
        showAlert('Conflito de horário para este médico!', 'error');
        return;
    }

    currentAppointment = {
        id: generateId(),
        patientName: patientNameInput.value.trim(),
        patientPhone: patientPhoneInput.value.trim(),
        birthType: birthTypeSelect.value,
        doctor: selectedDoctor,
        date: birthDateInput.value,
        time: birthTimeInput.value,
        datetime: appointmentDate.getTime(),
        notes: notesInput.value.trim(),
        status: 'agendado'
    };

    showConfirmationModal(currentAppointment);
}

function showConfirmationModal(appointment) {
    modalDetails.innerHTML = `
        <p><strong>Paciente:</strong> ${appointment.patientName}</p>
        <p><strong>Telefone:</strong> ${appointment.patientPhone}</p>
        <p><strong>Data:</strong> ${formatDate(appointment.date)} ${appointment.time}</p>
    `;

    btnConfirmAppointment.textContent = 'Confirmar';
    btnConfirmAppointment.onclick = confirmAppointment;

    confirmationModal.style.display = 'flex';
}

function confirmAppointment() {
    if (!currentAppointment) return;

    appointments.push(currentAppointment);
    saveAppointments();
    confirmationModal.style.display = 'none';
    clearForm();
    renderCalendar();
    showAlert('Agendamento criado com sucesso!', 'success');
}

function concludeAppointment(id) {
    const appointment = appointments.find(app => app && app.id === id);
    if (!appointment || appointment.status === 'concluido') {
        confirmationModal.style.display = 'none';
        return;
    }

    appointment.status = 'concluido';
    saveAppointments();
    renderCalendar();
    confirmationModal.style.display = 'none';
    showAlert('Agendamento concluído!', 'success');
}

function checkForConflicts(doctor, date, id) {
    const FIVE_HOURS = 5 * 60 * 60 * 1000;
    return appointments.filter(app => {
        if (!app) return false;
        if (id && app.id === id) return false;
        if (app.doctor !== doctor) return false;
        return Math.abs(app.datetime - date.getTime()) < FIVE_HOURS;
    });
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    currentMonthElement.textContent = `${monthNames[month]} ${year}`;

    calendarElement.innerHTML = '';
    const calendarBody = document.createElement('div');
    calendarBody.className = 'calendar-body';

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    for (let i = 0; i < firstDayIndex; i++) {
        calendarBody.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';

        const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayAppts = appointments.filter(app => app && app.date === dateStr);

        dayEl.innerHTML = `<div class="day-number">${day}</div>`;

        dayAppts.forEach(app => {
            const el = document.createElement('div');
            el.className = `appointment ${app.status === 'concluido' ? 'appointment-done' : ''}`;
            el.innerHTML = `${app.time} - ${app.patientName.split(' ')[0]}`;
            el.onclick = () => showAppointmentDetails(app.id);
            dayEl.appendChild(el);
        });

        calendarBody.appendChild(dayEl);
    }

    calendarElement.appendChild(calendarBody);
}

function showAppointmentDetails(id) {
    const appointment = appointments.find(app => app && app.id === id);
    if (!appointment) return;

    modalDetails.innerHTML = `
        <p><strong>Paciente:</strong> ${appointment.patientName}</p>
        <p><strong>Status:</strong> ${appointment.status}</p>
    `;

    btnConfirmAppointment.textContent =
        appointment.status === 'concluido' ? 'OK' : 'Concluir';

    btnConfirmAppointment.onclick = () => {
        appointment.status === 'concluido'
            ? confirmationModal.style.display = 'none'
            : concludeAppointment(id);
    };

    confirmationModal.style.display = 'flex';
}

function clearForm() {
    patientNameInput.value = '';
    patientPhoneInput.value = '';
    notesInput.value = '';
    selectedDoctor = null;
    doctorOptions.forEach(o => o.classList.remove('selected'));
}

function saveAppointments() {
    localStorage.setItem('birth_appointments', JSON.stringify(appointments));
}

function showAlert(msg, type) {
    alertContainer.innerHTML = `<div class="alert ${type}">${msg}</div>`;
    setTimeout(() => alertContainer.innerHTML = '', 4000);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('pt-BR');
}

// =========================
renderCalendar();
validateForm();
