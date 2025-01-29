class FormHandler {
    constructor() {
        this.initializeElements();
        this.fa1Parser = new FA1Parser();
        this.fa1Generator = new FA1Generator();
        this.initializeEventListeners();
    }

    initializeElements() {
        const elements = {
            fileInput: 'fa1-file',
            programList: 'program-list',
            alarmList: 'alarm-list',
            programTemplate: 'program-template',
            alarmTemplate: 'alarm-template'
        };

        // Initialize all elements and throw error if any are missing
        Object.entries(elements).forEach(([key, id]) => {
            this[key] = document.getElementById(id);
            if (!this[key]) throw new Error(`Required element ${id} missing`);
        });
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => 
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));

        // File handling
        this.fileInput.addEventListener('change', e => 
            this.handleFileInput(e).catch(error => alert('Error handling file: ' + error.message)));

        // Button actions
        const buttons = {
            'add-program': () => this.addProgram(),
            'add-program-bottom': () => this.addProgram(),
            'add-alarm': () => this.addAlarm(),
            'add-alarm-bottom': () => this.addAlarm(),
            'generate-fa1': () => this.generateFA1()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        });

        // Clear button
        const clearButton = document.querySelector('.btn-clear');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearForm());
        }
    }

    async handleFileInput(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        try {
            const parsedData = await this.fa1Parser.parseFA1File(file);
            
            // Clear existing entries
            this.programList.innerHTML = '';
            this.alarmList.innerHTML = '';
            
            // Add programs
            parsedData.programs.forEach((program) => {
                this.addProgram();
                const entry = this.programList.lastElementChild;
                if (entry) {
                    this.populateProgramEntry(entry, program);
                }
            });

            // Add alarms
            parsedData.alarms.forEach((alarm) => {
                this.addAlarm();
                const entry = this.alarmList.lastElementChild;
                if (entry) {
                    this.populateAlarmEntry(entry, alarm);
                }
            });
        } catch (error) {
            alert('Error reading FA1 file: ' + error.message);
        }
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    }

    addEntry(type) {
        const template = type === 'program' ? this.programTemplate : this.alarmTemplate;
        const list = type === 'program' ? this.programList : this.alarmList;
        const entryClass = `${type}-entry`;

        const entry = template.content.cloneNode(true).querySelector(`.${entryClass}`);
        if (!entry) return;

        // Add remove button handler
        entry.querySelector('.btn-remove').addEventListener('click', () => entry.remove());

        // Add validations
        const tempInput = entry.querySelector('.temperature');
        this.addTemperatureValidation(tempInput);

        if (type === 'program') {
            const timerInputs = {
                hours: entry.querySelector('.timer-hours'),
                minutes: entry.querySelector('.timer-minutes'),
                seconds: entry.querySelector('.timer-seconds')
            };
            this.addTimerValidation(timerInputs);
        }

        list.appendChild(entry);
    }

    addProgram() {
        this.addEntry('program');
    }

    addAlarm() {
        this.addEntry('alarm');
    }

    // Add helper method for temperature validation
    addTemperatureValidation(input) {
        input.addEventListener('blur', () => {
            const value = parseInt(input.value);
            if (isNaN(value) || value < 0) input.value = 0;
            if (value > 482) input.value = 482;
        });
    }

    // Add new method for timer validation
    addTimerValidation(timerInputs) {
        const validateTimer = () => {
            // Get values, but don't default to 0 yet
            let hours = timerInputs.hours.value === '' ? '' : parseInt(timerInputs.hours.value);
            let minutes = timerInputs.minutes.value === '' ? '' : parseInt(timerInputs.minutes.value);
            let seconds = timerInputs.seconds.value === '' ? '' : parseInt(timerInputs.seconds.value);

            // Check if all fields are empty
            const allEmpty = [hours, minutes, seconds].every(val => val === '');
            if (allEmpty) {
                return; // Leave all fields empty
            }

            // If any field has a value, ensure all fields have numeric values
            hours = isNaN(hours) ? 0 : hours;
            minutes = isNaN(minutes) ? 0 : minutes;
            seconds = isNaN(seconds) ? 0 : seconds;

            // Convert everything to seconds to check total time
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            const maxSeconds = 72 * 3600; // 72 hours in seconds

            if (totalSeconds > maxSeconds) {
                hours = 72;
                minutes = 0;
                seconds = 0;
            }

            // Ensure individual fields are within bounds
            if (hours > 72) hours = 72;
            if (hours === 72) {
                minutes = 0;
                seconds = 0;
            }
            if (minutes > 59) minutes = 59;
            if (seconds > 59) seconds = 59;

            // Update the input fields
            timerInputs.hours.value = hours;
            timerInputs.minutes.value = minutes;
            timerInputs.seconds.value = seconds;
        };

        // Add blur event listeners to all timer inputs
        timerInputs.hours.addEventListener('blur', validateTimer);
        timerInputs.minutes.addEventListener('blur', validateTimer);
        timerInputs.seconds.addEventListener('blur', validateTimer);
    }

    generateFA1() {
        const programs = Array.from(this.programList.children).map(entry => this.getProgramData(entry));
        const alarms = Array.from(this.alarmList.children).map(entry => this.getAlarmData(entry));
        
        if (programs.length + alarms.length === 0) {
            alert('Please add at least one program or alarm');
            return;
        }

        this.fa1Generator.downloadFA1File(programs, alarms);
    }

    // Helper methods for getting form data
    getProgramData(entry) {
        return {
            name: entry.querySelector('.program-name').value,
            temperature: parseInt(entry.querySelector('.temperature').value),
            powerLevel: entry.querySelector('.power-level').value,
            timer: this.getTimerString(entry),
            timerStart: entry.querySelector('.timer-start').value,
            afterTimer: entry.querySelector('.after-timer').value
        };
    }

    getAlarmData(entry) {
        return {
            name: entry.querySelector('.alarm-name').value.trim(),
            temperature: parseInt(entry.querySelector('.temperature').value)
        };
    }

    getTimerString(entry) {
        const hours = entry.querySelector('.timer-hours').value.padStart(2, '0');
        const minutes = entry.querySelector('.timer-minutes').value.padStart(2, '0');
        const seconds = entry.querySelector('.timer-seconds').value.padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    populateProgramEntry(entry, program) {
        try {
            const nameInput = entry.querySelector('.program-name');
            const tempInput = entry.querySelector('.temperature');
            const powerInput = entry.querySelector('.power-level');
            const timerHours = entry.querySelector('.timer-hours');
            const timerMinutes = entry.querySelector('.timer-minutes');
            const timerSeconds = entry.querySelector('.timer-seconds');
            const timerStartInput = entry.querySelector('.timer-start');
            const afterTimerInput = entry.querySelector('.after-timer');

            if (!nameInput || !tempInput || !powerInput || !timerHours || !timerMinutes || 
                !timerSeconds || !timerStartInput || !afterTimerInput) {
                throw new Error('Form elements not found');
            }

            nameInput.value = program.name;
            tempInput.value = program.temperature;
            powerInput.value = program.powerLevel;
            
            if (program.timer !== 'off') {
                const [hours, minutes, seconds] = program.timer.split(':');
                timerHours.value = parseInt(hours);
                timerMinutes.value = parseInt(minutes);
                timerSeconds.value = parseInt(seconds);
            }
            
            timerStartInput.value = program.timerStart;
            afterTimerInput.value = program.afterTimer;
        } catch (error) {
            throw error;
        }
    }

    populateAlarmEntry(entry, alarm) {
        try {
            const nameInput = entry.querySelector('.alarm-name');
            const tempInput = entry.querySelector('.temperature');

            if (!nameInput || !tempInput) {
                throw new Error('Form elements not found');
            }

            nameInput.value = alarm.name;
            tempInput.value = alarm.temperature;
        } catch (error) {
            throw error;
        }
    }

    clearForm() {
        if (confirm('Are you sure you want to clear all form data?')) {
            // Clear program list
            this.programList.innerHTML = '';
            
            // Clear alarm list
            this.alarmList.innerHTML = '';
            
            // Clear file input
            this.fileInput.value = '';
        }
    } 
}
