document.addEventListener('DOMContentLoaded', () => {
    const channelsList = document.querySelector('.channels-list');
    const programsContainer = document.querySelector('.programs-container');
    const currentDateElement = document.getElementById('currentDate');
    const timeSlots = document.querySelector('.time-slots');
    const modal = document.getElementById('programModal');
    const themeToggle = document.getElementById('themeToggle');
    let currentDate = new Date();
    const timeSlotWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--time-slot-width'));
    const MINUTES_PER_SLOT = 30;

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = themeToggle.querySelector('i');
        if (theme === 'light') {
            icon.style.color = '#ffd700';
        } else {
            icon.style.color = '#ffffff';
        }
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    });

    function generateTimeSlots() {
        timeSlots.innerHTML = '';
        for (let hour = 0; hour < 24; hour++) {
            for (let minutes = 0; minutes < 60; minutes += 30) {
                const timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                timeSlot.textContent = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                timeSlots.appendChild(timeSlot);
            }
        }
    }

    function updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateElement.textContent = currentDate.toLocaleDateString('es-ES', options)
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function parseXMLDate(dateString) {
        if (!dateString) return null;
        
        const year = parseInt(dateString.substring(0, 4));
        const month = parseInt(dateString.substring(4, 6)) - 1;
        const day = parseInt(dateString.substring(6, 8));
        const hour = parseInt(dateString.substring(8, 10));
        const minute = parseInt(dateString.substring(10, 12));
        
        return new Date(year, month, day, hour, minute);
    }

    function calculateProgramPosition(startTime, endTime) {
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        dayEnd.setHours(23, 59, 59, 999);

        let effectiveStartTime = startTime < dayStart ? dayStart : startTime;
        let effectiveEndTime = endTime > dayEnd ? dayEnd : endTime;

        const startMinutesFromDayStart = (effectiveStartTime.getHours() * 60) + effectiveStartTime.getMinutes();
        const endMinutesFromDayStart = (effectiveEndTime.getHours() * 60) + effectiveEndTime.getMinutes();

        const minuteWidth = timeSlotWidth / MINUTES_PER_SLOT;
        const left = startMinutesFromDayStart * minuteWidth;
        const width = (endMinutesFromDayStart - startMinutesFromDayStart) * minuteWidth;

        return { 
            left, 
            width: Math.max(width, minuteWidth),
            isPartial: startTime < dayStart || endTime > dayEnd,
            originalStart: startTime,
            originalEnd: endTime
        };
    }

    function showProgramDetails(program, channelName, startTime, endTime) {
        const title = program.getElementsByTagName('title')[0]?.textContent || 'Sin título';
        const description = program.getElementsByTagName('desc')[0]?.textContent || 'Sin descripción';
        const iconElement = program.getElementsByTagName('icon')[0];
        const iconSrc = iconElement ? iconElement.textContent.trim() : '';

        modal.querySelector('.modal-title').textContent = title;
        modal.querySelector('.modal-time').textContent = `${formatTime(startTime)} - ${formatTime(endTime)}`;
        modal.querySelector('.modal-channel').textContent = channelName;
        modal.querySelector('.modal-description').textContent = description;
        
        const modalImage = modal.querySelector('.modal-image');
        if (iconSrc) {
            modalImage.src = iconSrc;
            modalImage.alt = title;
            modalImage.style.display = 'block';
        } else {
            modalImage.style.display = 'none';
        }

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Configurar el botón XMLTV
        const xmltvButton = modal.querySelector('.xmltv-button');
        xmltvButton.onclick = (e) => {
            e.stopPropagation();
            const channelId = program.getAttribute('channel');
            window.location.href = `xmltv-sources.html?channel=${encodeURIComponent(channelName)}&id=${encodeURIComponent(channelId)}`;
        };
    }

    function closeModal() {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    async function loadProgramData() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/migpaniag/EPGS/main/all_in_one/all_in_one.xml', {
                headers: {
                    'Accept': 'application/xml'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('Error al parsear XML');
            }
            
            channelsList.innerHTML = '';
            programsContainer.innerHTML = '';
            
            const channels = xmlDoc.getElementsByTagName('channel');
            const dayStart = new Date(currentDate);
            const dayEnd = new Date(currentDate);
            const prevDayEnd = new Date(currentDate);
            
            dayStart.setHours(0, 0, 0, 0);
            dayEnd.setHours(23, 59, 59, 999);
            prevDayEnd.setHours(-1, 59, 59, 999);
            
            Array.from(channels).forEach(channel => {
                const channelId = channel.getAttribute('id');
                const channelName = channel.getElementsByTagName('display-name')[0]?.textContent || 'Canal sin nombre';
                
                const channelElement = document.createElement('div');
                channelElement.className = 'channel';
                channelElement.textContent = channelName;
                channelsList.appendChild(channelElement);
                
                const programsRow = document.createElement('div');
                programsRow.className = 'programs-row';
                
                const programs = xmlDoc.querySelectorAll(`programme[channel="${channelId}"]`);
                
                programs.forEach(program => {
                    const startTime = parseXMLDate(program.getAttribute('start'));
                    const endTime = parseXMLDate(program.getAttribute('stop'));
                    
                    if (!startTime || !endTime) return;

                    if ((startTime <= dayEnd && endTime >= dayStart) || 
                        (startTime <= prevDayEnd && endTime >= dayStart)) {
                        const { left, width, isPartial, originalStart, originalEnd } = calculateProgramPosition(startTime, endTime);
                        const programElement = createProgramElement(program, originalStart, originalEnd, left, width, isPartial);
                        programElement.addEventListener('click', () => {
                            showProgramDetails(program, channelName, originalStart, originalEnd);
                        });
                        programsRow.appendChild(programElement);
                    }
                });
                
                programsContainer.appendChild(programsRow);
            });
        } catch (error) {
            console.error('Error al cargar los datos:', error);
            programsContainer.innerHTML = `<p>Error al cargar la programación: ${error.message}</p>`;
        }
    }

    function createProgramElement(program, startTime, endTime, left, width, isPartial) {
        const programElement = document.createElement('div');
        programElement.className = 'program';
        if (isPartial) {
            programElement.classList.add('program-partial');
        }
        
        const title = program.getElementsByTagName('title')[0]?.textContent || 'Sin título';
        const description = program.getElementsByTagName('desc')[0]?.textContent || '';
        
        programElement.innerHTML = `
            <div class="program-title">${title}</div>
            <div class="program-time">
                ${formatTime(startTime)} - ${formatTime(endTime)}
            </div>
            ${description ? `<div class="program-desc">${description}</div>` : ''}
        `;
        
        programElement.style.left = `${left}px`;
        programElement.style.width = `${width}px`;
        
        return programElement;
    }

    function formatTime(date) {
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    function isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    document.getElementById('prevDay').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        updateDateDisplay();
        loadProgramData();
    });

    document.getElementById('nextDay').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        updateDateDisplay();
        loadProgramData();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    generateTimeSlots();
    updateDateDisplay();
    loadProgramData();
});
