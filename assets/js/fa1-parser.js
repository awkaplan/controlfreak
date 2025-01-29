class FA1Parser {
    constructor() {
        this.BUFFER_LENGTH = 8192;      // Total file size
        this.ALARM_OFFSET = 4096;       // Where alarms start
        this.BLOCK_LENGTH = 256;        // Size of each block
        this.ENTRY_LENGTH = 36;         // Size of each program/alarm entry
        this.ENTRIES_PER_BLOCK = 7;     // Number of entries per block
        
        this.PROGRAM_NAME_LENGTH = 26;
        this.ALARM_NAME_LENGTH = 20;
        this.TEMP_MOD = 255;
        console.log('FA1Parser initialized');
    }

    async parseFA1File(file) {
        console.log(`Starting to parse FA1 file: ${file.name} Size: ${file.size} bytes`);
        
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        
        const programs = [];
        const alarms = [];

        // Parse programs (first 4KB)
        console.log('Parsing programs...');
        for (let block = 0; block < 16; block++) {
            for (let entry = 0; entry < this.ENTRIES_PER_BLOCK; entry++) {
                const offset = (block * this.BLOCK_LENGTH) + (entry * this.ENTRY_LENGTH);
                const firstByte = view.getUint8(offset);
                
                if (firstByte === 0xFF) continue;
                
                const program = this.parseProgram(new DataView(buffer, offset, this.ENTRY_LENGTH));
                if (program) {
                    console.log('Found program:', program);
                    programs.push(program);
                }
            }
        }

        // Parse alarms (second 4KB)
        console.log('Parsing alarms...');
        for (let block = 16; block < 32; block++) {
            for (let entry = 0; entry < this.ENTRIES_PER_BLOCK; entry++) {
                const offset = (block * this.BLOCK_LENGTH) + (entry * this.ENTRY_LENGTH);
                const firstByte = view.getUint8(offset);
                
                if (firstByte === 0xFF) continue;
                
                const alarm = this.parseAlarm(new DataView(buffer, offset, this.ENTRY_LENGTH));
                if (alarm) {
                    console.log('Found alarm:', alarm);
                    alarms.push(alarm);
                }
            }
        }

        console.log(`Finished parsing. Found ${programs.length} programs and ${alarms.length} alarms`);
        return { programs, alarms };
    }

    parseProgram(view) {
        // Read program name (up to 26 bytes)
        let name = '';
        for (let i = 0; i < this.PROGRAM_NAME_LENGTH; i++) {
            const char = view.getUint8(i);
            if (char === 0) break;
            name += String.fromCharCode(char);
        }
        name = name.trim();
        if (!name) return null;

        // Read temperature and control bytes
        let temperature = view.getUint8(30);
        const control = view.getUint8(31);
        
        if ((control & 0x80) !== 0) {
            temperature += this.TEMP_MOD;
        }

        const hours = view.getUint8(32);
        const minutes = view.getUint8(33);
        const seconds = view.getUint8(34);

        const powerLevels = ['Slow', 'Medium', 'Fast'];
        const powerLevel = powerLevels[(control >> 2) & 0x03] || 'Slow';

        const timerStarts = ['At Beginning', 'At Set Temperature', 'At Prompt'];
        const timerStart = timerStarts[control & 0x03] || 'At Beginning';

        const afterTimers = ['Continue Cooking', 'Stop Cooking', 'Keep Warm', 'Repeat Timer'];
        const afterTimer = afterTimers[(control >> 5) & 0x03] || 'Continue Cooking';

        const timer = (hours === 0 && minutes === 0 && seconds === 0) ? 
            'off' : 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const program = {
            name,
            temperature,
            powerLevel,
            timer,
            timerStart,
            afterTimer
        };
        
        console.log('Parsed program:', program);
        return program;
    }

    parseAlarm(view) {
        // Read alarm name (up to 20 bytes)
        let name = '';
        for (let i = 0; i < this.ALARM_NAME_LENGTH; i++) {
            const char = view.getUint8(i);
            if (char === 0) break;
            name += String.fromCharCode(char);
        }
        name = name.trim();
        if (!name) return null;

        // Read temperature
        let temperature = view.getUint8(30);
        const control = view.getUint8(31);
        
        // Adjust temperature if needed
        if ((control & 0x80) !== 0) {
            temperature += this.TEMP_MOD;
        }

        return {
            name,
            temperature
        };
    }
}
