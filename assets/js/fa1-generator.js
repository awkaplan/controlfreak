class FA1Generator {
    constructor() {
        this.BUFFER_LENGTH = 8192;      // Total file size
        this.ALARM_OFFSET = 4096;       // Where alarms start
        this.BLOCK_LENGTH = 256;        // Size of each block
        this.ENTRY_LENGTH = 36;         // Size of each program/alarm entry
        this.ENTRIES_PER_BLOCK = 7;     // Number of entries per block
        
        this.PROGRAM_NAME_LENGTH = 26;
        this.ALARM_NAME_LENGTH = 20;
        this.TEMP_MIN = 0;
        this.TEMP_MAX = 482;
        this.TEMP_MOD = 255;
    }

    generateFA1File(programs = [], alarms = []) {
        // Create buffer for entire file
        const buffer = new ArrayBuffer(this.BUFFER_LENGTH);
        const view = new DataView(buffer);

        // Fill entire buffer with 0xFF (terminator value)
        for (let i = 0; i < this.BUFFER_LENGTH; i++) {
            view.setUint8(i, 0xFF);
        }

        // Write programs to first 4KB
        let currentBlock = 0;
        let entryInBlock = 0;
        
        for (const program of programs) {
            const offset = (currentBlock * this.BLOCK_LENGTH) + (entryInBlock * this.ENTRY_LENGTH);
            const programBuffer = this.generateProgramEntry(program);
            new Uint8Array(buffer).set(new Uint8Array(programBuffer), offset);

            entryInBlock++;
            if (entryInBlock >= this.ENTRIES_PER_BLOCK) {
                currentBlock++;
                entryInBlock = 0;
            }
        }

        // Write alarms to second 4KB
        currentBlock = this.ALARM_OFFSET / this.BLOCK_LENGTH; // Start at block 16
        entryInBlock = 0;
        
        for (const alarm of alarms) {
            const offset = (currentBlock * this.BLOCK_LENGTH) + (entryInBlock * this.ENTRY_LENGTH);
            const alarmBuffer = this.generateAlarmEntry(alarm);
            new Uint8Array(buffer).set(new Uint8Array(alarmBuffer), offset);

            entryInBlock++;
            if (entryInBlock >= this.ENTRIES_PER_BLOCK) {
                currentBlock++;
                entryInBlock = 0;
            }
        }

        return buffer;
    }

    generateProgramEntry(program) {
        const buffer = new ArrayBuffer(this.ENTRY_LENGTH);
        const view = new DataView(buffer);
        const encoder = new TextEncoder();

        // Write name (null-terminated)
        const nameBytes = encoder.encode(program.name);
        for (let i = 0; i < this.PROGRAM_NAME_LENGTH; i++) {
            view.setUint8(i, i < nameBytes.length ? nameBytes[i] : 0);
        }

        // Write temperature and control byte
        const temp = program.temperature;
        if (temp > this.TEMP_MOD) {
            view.setUint8(30, temp - this.TEMP_MOD);
            view.setUint8(31, 0x80);
        } else {
            view.setUint8(30, temp);
        }

        // Combine control bits
        const controlByte = 
            ((this.afterTimerToValue(program.afterTimer) & 0x03) << 5) |
            ((this.powerLevelToValue(program.powerLevel) & 0x03) << 2) |
            (this.timerStartToValue(program.timerStart) & 0x03);
        
        view.setUint8(31, view.getUint8(31) | controlByte);

        // Write timer values
        const timer = this.parseTimer(program.timer);
        view.setUint8(32, timer.hours);
        view.setUint8(33, timer.minutes);
        view.setUint8(34, timer.seconds);

        // Calculate and write checksum
        const bytes = new Uint8Array(buffer, 0, 35);
        const checksum = this.calculateChecksum(bytes);
        view.setUint8(35, checksum);

        return buffer;
    }

    generateAlarmEntry(alarm) {
        const buffer = new ArrayBuffer(this.ENTRY_LENGTH);
        const view = new DataView(buffer);
        const encoder = new TextEncoder();

        // Write name (null-terminated)
        const nameBytes = encoder.encode(alarm.name);
        for (let i = 0; i < this.ALARM_NAME_LENGTH; i++) {
            view.setUint8(i, i < nameBytes.length ? nameBytes[i] : 0);
        }

        // Write temperature
        const temp = alarm.temperature;
        if (temp > this.TEMP_MOD) {
            view.setUint8(30, temp - this.TEMP_MOD);
            view.setUint8(31, 0x80);
        } else {
            view.setUint8(30, temp);
        }

        // Calculate and write checksum
        const bytes = new Uint8Array(buffer, 0, 35);
        const checksum = this.calculateChecksum(bytes);
        view.setUint8(35, checksum);

        return buffer;
    }

    // Helper methods to convert strings to enum values
    powerLevelToValue(level) {
        const levels = { 'Slow': 0, 'Medium': 1, 'Fast': 2, 'Max': 3 };
        return levels[level] || 0;
    }

    timerStartToValue(start) {
        const starts = { 'At Beginning': 0, 'At Set Temperature': 1, 'At Prompt': 2 };
        return starts[start] || 0;
    }

    afterTimerToValue(action) {
        const actions = { 'Continue Cooking': 0, 'Stop Cooking': 1, 'Keep Warm': 2, 'Repeat Timer': 3 };
        return actions[action] || 0;
    }

    parseTimer(timerStr) {
        // Handle undefined, empty string, or invalid values
        if (!timerStr || timerStr === 'off' || timerStr === 'no timer') {
            return { hours: 0, minutes: 0, seconds: 0 };
        }
        const [hours, minutes, seconds] = timerStr.split(':').map(Number);
        return { hours, minutes, seconds };
    }

    calculateChecksum(bytes) {
        return bytes.reduce((sum, byte) => (sum + byte) & 0xFF, 0);
    }

    // Helper method to create a download link for the generated file
    downloadFA1File(programs, alarms, filename = 'CMC850.FA1') {
        const buffer = this.generateFA1File(programs, alarms);
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
} 
