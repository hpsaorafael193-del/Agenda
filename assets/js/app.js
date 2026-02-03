// Estado da aplicação
let appointments = JSON.parse(localStorage.getItem('birth_appointments')) || [];
let currentDate = new Date();
let selectedDoctor = null;
let currentAppointment = null;

// Elementos DOM
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

// Inicializar data mínima como hoje
const today = new Date();
const formattedToday = today.toISOString().split('T')[0];
birthDateInput.min = formattedToday;

// Inicializar horário padrão (8:00 AM)
birthTimeInput.value = '08:00';

// Event Listeners para seleção de médico
doctorOptions.forEach(option => {
    option.addEventListener('click', () => {
        doctorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedDoctor = option.getAttribute('data-doctor');
        validateForm();
    });
});

// Event Listener para agendamento
btnSchedule.addEventListener('click', scheduleAppointment);

// Event Listeners para navegação do calendário
btnPrevMonth.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

btnNextMonth.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// Event Listeners para o modal
btnCloseModal.addEventListener('click', () => {
    confirmationModal.style.display = 'none';
});

btnCancelAppointment.addEventListener('click', () => {
    confirmationModal.style.display = 'none';
});

// ✅ CORREÇÃO CRÍTICA:
// ❌ Removido: btnConfirmAppointment.addEventListener('click', confirmAppointment);
// O comportamento do botão Confirmar/OK será definido dinamicamente via .onclick
// dentro de showConfirmationModal() e showAppointmentDetails().

// Validar formulário em tempo real
[patientNameInput, patientPhoneInput, birthDateInput, birthTimeInput].forEach(input => {
    input.addEventListener('input', validateForm);
});

// Inicializar
renderCalendar();
validateForm();

// Funções
function validateForm() {
    const isFormValid =
        patientNameInput.value.trim() !== '' &&
        patientPhoneInput.value.trim() !== '' &&
        birthDateInput.value !== '' &&
        birthTimeInput.value !== '' &&
        selectedDoctor !== null;

    btnSchedule.disabled = !isFormValid;
    return isFormValid;
}

function scheduleAppointment() {
    if (!validateForm()) {
        showAlert('Preencha todos os campos obrigatórios!', 'error');
        return;
    }

    const appointmentDate = new Date(`${birthDateInput.value}T${birthTimeInput.value}`);

    // Validar se a data é no futuro
    if (appointmentDate < new Date()) {
        showAlert('Não é possível agendar para datas/horários passados!', 'error');
        return;
    }

    // Validar conflitos de horário
    const conflicts = checkForConflicts(
        selectedDoctor,
        appointmentDate,
        null // Novo agendamento, sem ID
    );

    if (conflicts.length > 0) {
        showAlert(`Conflito de horário! Já existe um parto agendado para este médico com menos de 5 horas de diferença.`, 'error');
        return;
    }

    // Criar objeto do agendamento
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

    // Mostrar modal de confirmação (modo criar)
    showConfirmationModal(currentAppointment);
}

function showConfirmationModal(appointment) {
    const doctorName = appointment.doctor === 'natalie' ? 'Dra. Natalie Bianchi' : 'Dra. Anne D\'Luddhiev';
    const birthTypeNames = {
        'normal': 'Parto Normal',
        'humanizado': 'Parto Humanizado',
        'agendado': 'Parto Agendado'
    };

    modalDetails.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">Paciente:</div>
            <div class="detail-value">${appointment.patientName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Telefone:</div>
            <div class="detail-value">${appointment.patientPhone}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Médico:</div>
            <div class="detail-value">${doctorName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Data:</div>
            <div class="detail-value">${formatDate(appointment.date)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Horário:</div>
            <div class="detail-value">${appointment.time}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Tipo:</div>
            <div class="detail-value">${birthTypeNames[appointment.birthType]}</div>
        </div>
        ${appointment.notes ? `
        <div class="detail-row">
            <div class="detail-label">Observações:</div>
            <div class="detail-value">${appointment.notes}</div>
        </div>
        ` : ''}
    `;

    // ✅ Botão confirma no modo CRIAR
    btnConfirmAppointment.textContent = 'Confirmar';
    btnConfirmAppointment.onclick = confirmAppointment;

    confirmationModal.style.display = 'flex';
}

function confirmAppointment() {
    // Segurança: impede duplicar caso currentAppointment seja nulo
    if (!currentAppointment) {
        confirmationModal.style.display = 'none';
        return;
    }

    appointments.push(currentAppointment);
    saveAppointments();

    confirmationModal.style.display = 'none';
    showAlert('Parto agendado com sucesso!', 'success');
    clearForm();
    renderCalendar();
}

function concludeAppointment(appointmentId) {
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) return;

    if (appointment.status === 'concluido') {
        showAlert('Este agendamento já está concluído.', 'warning');
        confirmationModal.style.display = 'none';
        return;
    }

    appointment.status = 'concluido';
    saveAppointments();
    renderCalendar();

    confirmationModal.style.display = 'none';
    showAlert('Agendamento marcado como concluído!', 'success');
}

function checkForConflicts(doctor, appointmentDate, appointmentId) {
    const FIVE_HOURS = 5 * 60 * 60 * 1000; // 5 horas em milissegundos

    return appointments.filter(app => {
        // Ignorar o próprio agendamento (no caso de edição)
        if (appointmentId && app.id === appointmentId) return false;

        // Verificar se é o mesmo médico
        if (app.doctor !== doctor) return false;

        // Calcular diferença de tempo
        const existingDate = new Date(app.datetime);
        const timeDiff = Math.abs(appointmentDate.getTime() - existingDate.getTime());

        // Retornar verdadeiro se a diferença for menor que 5 horas
        return timeDiff < FIVE_HOURS;
    });
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Atualizar título do mês
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    currentMonthElement.textContent = `${monthNames[month]} ${year}`;

    // Obter primeiro e último dia do mês
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Obter dia da semana do primeiro dia (0 = Domingo, 1 = Segunda, etc.)
    let firstDayIndex = firstDay.getDay();
    // Ajustar para semana começar na segunda-feira (0 = Segunda)
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    // Limpar calendário
    calendarElement.innerHTML = '';

    // Adicionar cabeçalho dos dias da semana
    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const calendarHeader = document.createElement('div');
    calendarHeader.className = 'calendar-header';

    dayNames.forEach(day => {
        const headerCell = document.createElement('div');
        headerCell.className = 'calendar-header-cell';
        headerCell.textContent = day;
        calendarHeader.appendChild(headerCell);
    });

    calendarElement.appendChild(calendarHeader);

    // Adicionar corpo do calendário
    const calendarBody = document.createElement('div');
    calendarBody.className = 'calendar-body';

    // Adicionar células vazias para dias do mês anterior
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day day-disabled';
        calendarBody.appendChild(emptyDay);
    }

    // Adicionar dias do mês atual
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';

        // Verificar se é hoje
        if (isCurrentMonth && day === today.getDate()) {
            dayElement.classList.add('day-today');
        }

        // Número do dia
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);

        // Agendamentos do dia
        const dayAppointments = document.createElement('div');
        dayAppointments.className = 'day-appointments';

        // Filtrar agendamentos para este dia
        const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayAppts = appointments.filter(app => app.date === currentDateStr);

        // Ordenar por horário
        dayAppts.sort((a, b) => a.time.localeCompare(b.time));

        // Adicionar agendamentos
        dayAppts.forEach(app => {
            const appointmentElement = document.createElement('div');

            // ✅ opcional: marcar concluído visualmente (classe adicional)
            const statusClass = app.status === 'concluido' ? 'appointment-done' : '';

            appointmentElement.className = `appointment appointment-${app.doctor} ${statusClass}`.trim();
            appointmentElement.setAttribute('data-appointment-id', app.id);

            appointmentElement.innerHTML = `
                <div class="appointment-time">${app.time}</div>
                <div class="appointment-patient">${app.patientName.split(' ')[0]}</div>
            `;

            // Adicionar evento para mostrar detalhes
            appointmentElement.addEventListener('click', (e) => {
                e.stopPropagation();
                showAppointmentDetails(app.id);
            });

            dayAppointments.appendChild(appointmentElement);
        });

        dayElement.appendChild(dayAppointments);
        calendarBody.appendChild(dayElement);
    }

    calendarElement.appendChild(calendarBody);
}

function showAppointmentDetails(appointmentId) {
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) return;

    const doctorName = appointment.doctor === 'natalie' ? 'Dra. Natalie Bianchi' : 'Dra. Anne D\'Luddhiev';
    const birthTypeNames = {
        'normal': 'Parto Normal',
        'humanizado': 'Parto Humanizado',
        'agendado': 'Parto Agendado'
    };

    const details = `
        <div class="appointment-details">
            <div class="detail-row">
                <div class="detail-label">Paciente:</div>
                <div class="detail-value">${appointment.patientName}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Telefone:</div>
                <div class="detail-value">${appointment.patientPhone}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Médico:</div>
                <div class="detail-value">${doctorName}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Data:</div>
                <div class="detail-value">${formatDate(appointment.date)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Horário:</div>
                <div class="detail-value">${appointment.time}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Tipo:</div>
                <div class="detail-value">${birthTypeNames[appointment.birthType]}</div>
            </div>
            ${appointment.notes ? `
            <div class="detail-row">
                <div class="detail-label">Observações:</div>
                <div class="detail-value">${appointment.notes}</div>
            </div>
            ` : ''}
            <div class="detail-row">
                <div class="detail-label">Status:</div>
                <div class="detail-value">${appointment.status === 'agendado' ? 'Agendado' : 'Concluído'}</div>
            </div>
        </div>
        <div class="modal-buttons">
            <button class="btn-cancel" onclick="deleteAppointment('${appointment.id}')">
                <i class="fas fa-trash"></i> Cancelar Agendamento
            </button>
        </div>
    `;

    // Mostrar modal com detalhes
    modalDetails.innerHTML = details;

    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-calendar-alt"></i> Detalhes do Agendamento';
    }

    // ✅ Botão OK agora CONCLUI, ao invés de duplicar
    btnConfirmAppointment.textContent = appointment.status === 'concluido' ? 'OK' : 'Concluir';
    btnConfirmAppointment.onclick = () => {
        if (appointment.status === 'concluido') {
            confirmationModal.style.display = 'none';
            return;
        }
        concludeAppointment(appointment.id);
    };

    confirmationModal.style.display = 'flex';
}

function deleteAppointment(appointmentId) {
    if (confirm('Tem certeza que deseja cancelar este agendamento?')) {
        appointments = appointments.filter(app => app.id !== appointmentId);
        saveAppointments();
        renderCalendar();
        confirmationModal.style.display = 'none';
        showAlert('Agendamento cancelado com sucesso!', 'success');
    }
}

function clearForm() {
    patientNameInput.value = '';
    patientPhoneInput.value = '';
    birthTypeSelect.value = 'normal';
    doctorOptions.forEach(opt => opt.classList.remove('selected'));
    selectedDoctor = null;
    notesInput.value = '';

    // Resetar data para hoje
    birthDateInput.value = formattedToday;
    birthTimeInput.value = '08:00';

    validateForm();
}

function showAlert(message, type) {
    alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
            ${message}
        </div>
    `;

    // Remover alerta após 5 segundos
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

function saveAppointments() {
    localStorage.setItem('birth_appointments', JSON.stringify(appointments));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Fechar modal ao clicar fora
window.addEventListener('click', (e) => {
    if (e.target === confirmationModal) {
        confirmationModal.style.display = 'none';
    }
});

// Formatar telefone automaticamente
patientPhoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');

    value = value.substring(0, 9);

    if (value.length > 6) {
        value = value.replace(
            /^(\d{3})(\d{3})(\d{0,3})/,
            '($1) $2-$3'
        );
    } else if (value.length > 3) {
        value = value.replace(
            /^(\d{3})(\d{0,3})/,
            '($1) $2'
        );
    } else if (value.length > 0) {
        value = value.replace(
            /^(\d{0,3})/,
            '($1'
        );
    }

    e.target.value = value;
});
