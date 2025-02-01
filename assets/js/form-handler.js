class FormHandler {
    constructor() {
        this.initializeElements();
        this.fa1Parser = new FA1Parser();
        this.fa1Generator = new FA1Generator();
        this.loadPresets();
        this.initializeEventListeners();
        this.initializeFromURL();
    }

    initializeElements() {
        const elements = {
            fileInput: 'fa1-file',
            programList: 'program-list',
            alarmList: 'alarm-list',
            presetList: 'preset-list',
            programTemplate: 'program-template',
            alarmTemplate: 'alarm-template',
            presetTemplate: 'preset-template'
        };

        // Initialize all elements and throw error if any are missing
        Object.entries(elements).forEach(([key, id]) => {
            this[key] = document.getElementById(id);
            if (!this[key]) throw new Error(`Required element ${id} missing`);
        });
    }

    initializeEventListeners() {
        // Tab and file handling
        this.setupTabListeners();
        this.setupFileListener();

        // Button actions with consistent setup
        const buttonHandlers = {
            'add-program': () => this.addProgram(),
            'add-program-bottom': () => this.addProgram(),
            'add-alarm': () => this.addAlarm(),
            'add-alarm-bottom': () => this.addAlarm(),
            'generate-fa1': () => this.generateFA1(),
            'btn-clear': () => this.clearForm(),
            'btn-share': () => this.shareURL()
        };

        Object.entries(buttonHandlers).forEach(([selector, handler]) => {
            const elements = document.querySelectorAll(`.${selector}, #${selector}`);
            elements.forEach(el => el.addEventListener('click', handler));
        });

        // Preset buttons
        document.querySelectorAll('.btn-add-preset').forEach(btn => {
            btn.addEventListener('click', () => this.addPresetToPrograms(btn));
        });
    }

    setupTabListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => 
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
    }

    setupFileListener() {
        this.fileInput?.addEventListener('change', e => 
            this.handleFileInput(e).catch(error => this.showError('Error handling file:', error)));
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

            this.updateURL();
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
        const config = {
            program: { template: this.programTemplate, list: this.programList },
            alarm: { template: this.alarmTemplate, list: this.alarmList }
        }[type];

        if (!config) return;

        const entry = config.template.content.cloneNode(true).querySelector(`.${type}-entry`);
        if (!entry) return;

        // Setup remove button
        entry.querySelector('.btn-remove')?.addEventListener('click', () => {
            entry.remove();
            this.updateURL();
        });

        // Setup validations and URL updates
        this.setupEntryValidation(entry, type);
        
        config.list.appendChild(entry);
        this.updateURL();
    }

    addProgram() {
        this.addEntry('program');
    }
    
    addAlarm() {
        this.addEntry('alarm');
    }

    setupEntryValidation(entry, type) {
        // Add input listeners for URL updates
        entry.querySelectorAll('input, select').forEach(element => {
            ['input', 'change', 'blur'].forEach(event => {
                element.addEventListener(event, () => this.updateURL());
            });
        });

        // Temperature validation
        const tempInput = entry.querySelector('.temperature');
        if (tempInput) {
            this.addTemperatureValidation(tempInput);
        }

        // Timer validation for programs
        if (type === 'program') {
            const timerInputs = {
                hours: entry.querySelector('.timer-hours'),
                minutes: entry.querySelector('.timer-minutes'),
                seconds: entry.querySelector('.timer-seconds')
            };
            if (Object.values(timerInputs).every(Boolean)) {
                this.addTimerValidation(timerInputs);
            }
        }
    }

    // Simplified validation methods
    addTemperatureValidation(input) {
        const validate = () => {
            const value = parseInt(input.value);
            input.value = isNaN(value) ? 0 : Math.max(0, Math.min(482, value));
            this.updateURL();
        };
        ['blur', 'change'].forEach(event => input.addEventListener(event, validate));
    }

    addTimerValidation(inputs) {
        const validate = () => {
            const programEntry = inputs.hours.closest('.program-entry');
            const timerStartSelect = programEntry.querySelector('.timer-start');
            const afterTimerSelect = programEntry.querySelector('.after-timer');
            
            // Check if any timer-related values are set
            const timerValues = [
                ...Object.values(inputs).map(input => input.value),
                timerStartSelect.value,
                afterTimerSelect.value
            ];
            const hasAnyTimerValue = timerValues.some(Boolean);

            if (!hasAnyTimerValue) {
                // Clear all timer-related fields if no values are set
                Object.values(inputs).forEach(input => input.value = '');
                timerStartSelect.value = '';
                afterTimerSelect.value = '';
                return;
            }

            // Set defaults for timer fields and selects
            Object.values(inputs).forEach(input => input.value = input.value || '0');
            timerStartSelect.value = timerStartSelect.value || 'At Beginning';
            afterTimerSelect.value = afterTimerSelect.value || 'Continue Cooking';

            // Calculate and validate total time
            let [hours, minutes, seconds] = Object.values(inputs)
                .map(input => parseInt(input.value));
                
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            const maxSeconds = 72 * 3600;

            if (totalSeconds > maxSeconds) {
                [hours, minutes, seconds] = [72, 0, 0];
            } else {
                hours = Math.min(72, hours);
                minutes = hours === 72 ? 0 : Math.min(59, minutes);
                seconds = hours === 72 ? 0 : Math.min(59, seconds);
            }

            // Update input values
            inputs.hours.value = hours;
            inputs.minutes.value = minutes;
            inputs.seconds.value = seconds;

            this.updateURL();
        };

        // Add event listeners to all relevant fields
        [...Object.values(inputs), 
         inputs.hours.closest('.program-entry').querySelector('.timer-start'),
         inputs.hours.closest('.program-entry').querySelector('.after-timer')
        ].forEach(element => {
            ['blur', 'change'].forEach(event => 
                element.addEventListener(event, validate));
        });
    }

    trackEvent(action, label) {
        if (typeof gtag === 'function') {
            gtag('event', action, {
                'event_category': 'engagement',
                'event_label': label
            });
        }
    }

    generateFA1() {
        const programs = Array.from(this.programList.children).map(entry => this.getProgramData(entry));
        const alarms = Array.from(this.alarmList.children).map(entry => this.getAlarmData(entry));
        
        if (programs.length + alarms.length === 0) {
            alert('Please add at least one program or alarm');
            return;
        }

        this.trackEvent('generate', `Programs: ${programs.length}, Alarms: ${alarms.length}`);
        this.fa1Generator.downloadFA1File(programs, alarms);
    }

    // Helper methods for getting form data
    getProgramData(entry) {
        const hours = entry.querySelector('.timer-hours').value || '0';
        const minutes = entry.querySelector('.timer-minutes').value || '0';
        const seconds = entry.querySelector('.timer-seconds').value || '0';
        
        // Only create timer string if any value is non-zero
        const hasTimer = parseInt(hours) > 0 || parseInt(minutes) > 0 || parseInt(seconds) > 0;
        const timer = hasTimer ? `${hours}:${minutes}:${seconds}` : 'off';
    
        return {
            name: entry.querySelector('.program-name').value,
            temperature: parseInt(entry.querySelector('.temperature').value) || 0,
            powerLevel: entry.querySelector('.power-level').value || 'Slow',
            timer: timer,
            timerStart: entry.querySelector('.timer-start').value || 'At Beginning',
            afterTimer: entry.querySelector('.after-timer').value || 'Continue Cooking'
        };
    }

    getAlarmData(entry) {
        return {
            name: entry.querySelector('.alarm-name').value.trim(),
            temperature: parseInt(entry.querySelector('.temperature').value)
        };
    }

    getTimerString(entry) {
        const hours = entry.querySelector('.timer-hours').value;
        const minutes = entry.querySelector('.timer-minutes').value;
        const seconds = entry.querySelector('.timer-seconds').value;
        
        // If all timer fields are empty, return undefined
        if (!hours && !minutes && !seconds) {
            return undefined;
        }
        
        // Otherwise format the timer string
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
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
    
            // Set name (required field)
            nameInput.value = program.name || '';
            
            // Set temperature (leave blank if not set)
            tempInput.value = program.temperature !== undefined ? program.temperature : '';
            
            // Set power level (leave unselected if not set)
            powerInput.value = program.powerLevel || '';
            
            // Handle timer values
            if (program.timer && program.timer !== 'off') {
                const [hours, minutes, seconds] = program.timer.split(':');
                timerHours.value = hours || '';
                timerMinutes.value = minutes || '';
                timerSeconds.value = seconds || '';
            } else {
                timerHours.value = '';
                timerMinutes.value = '';
                timerSeconds.value = '';
            }
            
            // Set timer start and after timer (leave unselected if not set)
            timerStartInput.value = program.timerStart || '';
            afterTimerInput.value = program.afterTimer || '';
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
            this.programList.innerHTML = '';
            this.alarmList.innerHTML = '';
            this.fileInput.value = '';
            this.updateURL();
        }
    }

    async loadPresets() {
        // Get the base URL from the meta tag or default to root
        const baseUrl = document.querySelector('meta[name="baseurl"]')?.getAttribute('content') || '';
        const presetUrl = `assets/js/presets.json`;
        
        fetch(presetUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Extract presets array from the data object
                this.presets = data.presets || [];
                this.renderPresets();
            })
            .catch(error => {
                console.error('Error loading presets:', error);
                // Initialize with empty array if loading fails
                this.presets = [];
                this.renderPresets();
            });
    }

    renderPresets() {
        if (!this.presetList || !this.presetTemplate) {
            console.warn('Preset list or template elements not found');
            return;
        }
        
        this.presetList.innerHTML = '';
        
        if (!Array.isArray(this.presets) || this.presets.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-presets';
            emptyMessage.textContent = 'No presets available';
            this.presetList.appendChild(emptyMessage);
            return;
        }
        
        this.presets.forEach(preset => {
            const entry = this.presetTemplate.content.cloneNode(true);
            const container = entry.querySelector('.preset-entry');
            
            if (!container) {
                console.warn('Preset entry container not found in template');
                return;
            }
            
            // Fill in preset data
            container.querySelector('.col-name').textContent = preset.name || '';
            container.querySelector('.col-temp').textContent = (preset.temperature || 0) + '°F';
            container.querySelector('.col-power').textContent = preset.powerLevel || 'Slow';

            if (preset.timer) {
                container.querySelector('.col-timer').textContent = preset.timer;
            }
            if (preset.timerStart) {
                container.querySelector('.col-timer-start').textContent = preset.timerStart;
            }
            if (preset.afterTimer) {
                container.querySelector('.col-after-timer').textContent = preset.afterTimer;
            }
            
            // Add click handler to the add button
            const addButton = container.querySelector('.btn-add-preset');
            if (addButton) {
                addButton.addEventListener('click', () => {
                    this.addPresetToPrograms(preset);
                });
            }
            
            this.presetList.appendChild(container);
        });
    }

    addPresetToPrograms(preset) {
        this.addProgram();
        const entry = this.programList.lastElementChild;
        if (entry) {
            entry.querySelector('.program-name').value = preset.name;
            entry.querySelector('.temperature').value = preset.temperature;
            entry.querySelector('.power-level').value = preset.powerLevel;
            
            if (preset.timer) {
                const [hours, minutes, seconds] = preset.timer.split(':');
                entry.querySelector('.timer-hours').value = parseInt(hours);
                entry.querySelector('.timer-minutes').value = parseInt(minutes);
                entry.querySelector('.timer-seconds').value = parseInt(seconds);
            }
            
            entry.querySelector('.timer-start').value = preset.timerStart;
            entry.querySelector('.after-timer').value = preset.afterTimer;
            
            // Update URL after adding preset
            this.updateURL();
        }
    }

    initializeFromURL() {
        try {
            const params = new URLSearchParams(window.location.search);
            const compressed = params.get('d');

            if (!compressed) return;

            // Restore base64 padding
            const base64Restored = compressed
                .replace(/-/g, '+')
                .replace(/_/g, '/')
                .padEnd(compressed.length + ((4 - (compressed.length % 4)) % 4), '=');

            // Convert base64 to uint8array
            const binaryString = atob(base64Restored);
            const uint8array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8array[i] = binaryString.charCodeAt(i);
            }

            // Decompress data
            const decompressed = new TextDecoder().decode(pako.inflate(uint8array));
            const data = JSON.parse(decompressed);

            // Load programs
            if (data.programs) {
                data.programs.forEach(program => {
                    this.addProgram();
                    const entry = this.programList.lastElementChild;
                    if (entry) {
                        this.populateProgramEntry(entry, program);
                    }
                });
            }

            // Load alarms
            if (data.alarms) {
                data.alarms.forEach(alarm => {
                    this.addAlarm();
                    const entry = this.alarmList.lastElementChild;
                    if (entry) {
                        this.populateAlarmEntry(entry, alarm);
                    }
                });
            }
        } catch (error) {
            console.error('Error parsing URL data:', error);
        }
    }

    updateURL() {
        try {
            const data = {
                programs: Array.from(this.programList.children).map(entry => this.getProgramData(entry)),
                alarms: Array.from(this.alarmList.children).map(entry => this.getAlarmData(entry))
            };

            if (data.programs.length === 0 && data.alarms.length === 0) {
                window.history.replaceState({}, '', window.location.pathname);
                return;
            }

            // Convert to JSON string and compress
            const jsonString = JSON.stringify(data);
            const uint8array = new TextEncoder().encode(jsonString);
            const compressed = pako.deflate(uint8array);
            
            // Convert to URL-safe base64
            const base64 = btoa(String.fromCharCode.apply(null, compressed))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Update URL with compressed data
            const params = new URLSearchParams();
            params.set('d', base64);
            const newURL = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
            window.history.replaceState({}, '', newURL);
        } catch (error) {
            console.error('Error updating URL:', error);
        }
    }

    async shareURL() {
        const currentURL = window.location.href;
        
        this.trackEvent('share_config', 'Share URL');
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Control Freak Config',
                    text: 'Check out my Control Freak configuration',
                    url: currentURL
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error sharing:', error);
                    this.fallbackShare(currentURL);
                }
            }
        } else {
            this.fallbackShare(currentURL);
        }
    }

    fallbackShare(url) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url)
                .then(() => alert('URL copied to clipboard!'))
                .catch(error => {
                    console.error('Error copying to clipboard:', error);
                    this.showFallbackPrompt(url);
                });
        } else {
            this.showFallbackPrompt(url);
        }
    }

    showFallbackPrompt(url) {
        // Create a temporary input element
        const tempInput = document.createElement('input');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        
        // Select the text
        tempInput.select();
        tempInput.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            // Try to copy using document.execCommand
            document.execCommand('copy');
            alert('URL copied to clipboard!');
        } catch (err) {
            // If all else fails, show the URL to the user
            prompt('Copy this URL:', url);
        } finally {
            // Clean up
            document.body.removeChild(tempInput);
        }
    }

    showError(message, error) {
        console.error(message, error);
        alert(`${message} ${error.message}`);
    }
}
