class IKDAOCamera {
    constructor() {
        this.stream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.isPaused = false;
        this.isVideoMode = false;
        this.currentCamera = 'user';
        this.currentFilter = 'none';
        this.recordingStartTime = 0;
        this.timerInterval = null;
        this.devices = [];
        this.isTorchSupported = false;
        this.torchMode = 'off'; // 'off', 'on', 'auto'

        this.initElements();
        this.initEventListeners();
        this.initCamera();
    }

    initElements() {
        this.video = document.querySelector('.ikdao-camera-video');
        this.captureBtn = document.getElementById('ikdao-capture-btn');
        this.modeBtn = document.getElementById('ikdao-camera-mode-btn');
        this.switchCameraBtn = document.getElementById('ikdao-switch-camera-btn');
        this.torchBtn = document.getElementById('ikdao-torch-btn');
        this.menuBtn = document.getElementById('ikdao-menu-btn');
        this.menu = document.getElementById('ikdao-camera-menu');
        this.videoControls = document.getElementById('ikdao-video-controls');
        this.pauseBtn = document.getElementById('ikdao-pause-btn');
        this.stopBtn = document.getElementById('ikdao-stop-btn');
        this.timer = document.querySelector('.ikdao-camera-timer');
        this.recordingIndicator = document.querySelector('.ikdao-camera-recording-indicator');
        this.countdown = document.querySelector('.ikdao-camera-countdown');
        this.toast = document.getElementById('ikdao-toast');
    }

    initEventListeners() {
        this.captureBtn.addEventListener('click', () => this.handleCapture());
        this.modeBtn.addEventListener('click', () => this.toggleMode());
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.torchBtn.addEventListener('click', () => this.toggleTorch());
        this.menuBtn.addEventListener('click', () => this.toggleMenu());
        this.pauseBtn.addEventListener('click', () => this.pauseRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());

        // Filter buttons
        document.querySelectorAll('.ikdao-camera-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applyFilter(e.target.dataset.filter));
        });

        // Settings
        document.getElementById('ikdao-resolution').addEventListener('change', (e) => {
            this.changeResolution(e.target.value);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target) && !this.menuBtn.contains(e.target) && !this.torchBtn.contains(e.target)) {
                this.menu.classList.remove('open');
            }
        });
    }

    async initCamera() {
        try {
            await this.getCameraDevices();
            await this.startCamera();
            await this.populateSettings();
        } catch (error) {
            this.showToast('Camera access denied or not available');
            console.error('Camera initialization failed:', error);
        }
    }

    async getCameraDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.devices = devices.filter(device => device.kind === 'videoinput');
    }

    async startCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: this.currentCamera,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: true
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.detectTorchSupport();
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.showToast('Failed to access camera');
        }
    }

    async detectTorchSupport() {
        if (this.stream && this.currentCamera === 'environment') {
            const videoTrack = this.stream.getVideoTracks()[0];
            if (videoTrack) {
                try {
                    const capabilities = videoTrack.getCapabilities();
                    if ('torch' in capabilities) {
                        this.isTorchSupported = true;
                        this.torchBtn.classList.remove('ikdao-camera-hidden');
                        this.updateTorchIcon();
                    } else {
                        this.isTorchSupported = false;
                        this.torchBtn.classList.add('ikdao-camera-hidden');
                    }
                } catch (e) {
                    console.error('Could not get torch capabilities:', e);
                    this.isTorchSupported = false;
                    this.torchBtn.classList.add('ikdao-camera-hidden');
                }
            }
        } else {
            this.isTorchSupported = false;
            this.torchBtn.classList.add('ikdao-camera-hidden');
        }
    }

    async toggleTorch() {
        if (!this.isTorchSupported) {
            this.showToast('Torch is not supported on this camera.');
            return;
        }

        // Cycle through 'off' -> 'on' -> 'auto' -> 'off'
        if (this.torchMode === 'off') {
            this.torchMode = 'on';
            await this.setTorchState(true);
            this.showToast('Torch On');
        } else if (this.torchMode === 'on') {
            this.torchMode = 'auto';
            await this.setTorchState(false);
            this.showToast('Torch Auto (Flash on capture)');
        } else {
            this.torchMode = 'off';
            await this.setTorchState(false);
            this.showToast('Torch Off');
        }
        this.updateTorchIcon();
    }

    async setTorchState(state) {
        const videoTrack = this.stream.getVideoTracks()[0];
        if (videoTrack) {
            try {
                await videoTrack.applyConstraints({
                    advanced: [{ torch: state }]
                });
            } catch (e) {
                console.error('Failed to set torch state:', e);
            }
        }
    }

    updateTorchIcon() {
        this.torchBtn.classList.remove('active');
        if (this.torchMode === 'on') {
            this.torchBtn.textContent = 'flash_on';
            this.torchBtn.classList.add('active');
        } else if (this.torchMode === 'auto') {
            this.torchBtn.textContent = 'flash_auto';
            this.torchBtn.classList.add('active');
        } else {
            this.torchBtn.textContent = 'flash_off';
        }
    }

    async populateSettings() {
        const resolutionSelect = document.getElementById('ikdao-resolution');
        resolutionSelect.innerHTML = '';

        const commonResolutions = [
            { width: 1920, height: 1080, label: '1080p (1920x1080)' },
            { width: 1280, height: 720, label: '720p (1280x720)' },
            { width: 854, height: 480, label: '480p (854x480)' },
            { width: 640, height: 360, label: '360p (640x360)' }
        ];

        commonResolutions.forEach(res => {
            const option = document.createElement('option');
            option.value = `${res.width}x${res.height}`;
            option.textContent = res.label;
            resolutionSelect.appendChild(option);
        });
    }

    toggleMode() {
        this.isVideoMode = !this.isVideoMode;
        this.modeBtn.textContent = this.isVideoMode ? 'videocam' : 'photo_camera';
        this.modeBtn.title = this.isVideoMode ? 'Photo Mode' : 'Video Mode';

        // For video mode, auto flash is disabled. Torch becomes a manual toggle.
        if (this.isVideoMode) {
            this.captureBtn.style.background = 'red';
            if (this.torchMode === 'auto') {
                this.torchMode = 'off';
                this.updateTorchIcon();
            }
        } else {
            this.captureBtn.style.background = 'rgba(255, 255, 255, 0.9)';
            if (this.isRecording) {
                this.stopRecording();
            }
        }
    }

    async switchCamera() {
        this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
        await this.startCamera();
    }

    toggleMenu() {
        this.menu.classList.toggle('open');
    }

    applyFilter(filter) {
        // Remove active class from all filter buttons
        document.querySelectorAll('.ikdao-camera-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to clicked button
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        // Remove existing filter classes
        this.video.className = this.video.className.replace(/filter-\w+/g, '');

        // Apply new filter
        if (filter !== 'none') {
            this.video.classList.add(`filter-${filter}`);
        }
        this.currentFilter = filter;
    }

    async handleCapture() {
        if (this.isVideoMode) {
            if (!this.isRecording) {
                await this.startRecording();
            } else {
                this.stopRecording();
            }
        } else {
            const captureMode = document.getElementById('ikdao-capture-mode').value;

            if (captureMode === 'delayed') {
                await this.delayedCapture();
            } else if (captureMode === 'continuous') {
                await this.continuousCapture();
            } else {
                await this.flashAndCapture();
            }
        }
    }

    async flashAndCapture() {
        // If torch mode is 'auto', turn on the flash, capture, then turn it off
        if (this.torchMode === 'auto') {
            await this.setTorchState(true);
            await new Promise(resolve => setTimeout(resolve, 100)); // Short delay for flash to fire
            await this.takePhoto();
            await this.setTorchState(false);
        } else {
            // Otherwise, just take the photo
            await this.takePhoto();
        }
    }

    async delayedCapture() {
        // If auto flash is on, turn it on for the capture
        if (this.torchMode === 'auto') {
            await this.setTorchState(true);
        }

        for (let i = 3; i > 0; i--) {
            this.countdown.textContent = i;
            this.countdown.style.display = 'block';
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.countdown.style.display = 'none';
        await this.takePhoto();

        // Turn off the flash after capture
        if (this.torchMode === 'auto') {
            await this.setTorchState(false);
        }
    }

    async continuousCapture() {
        const burstCount = 5;
        const interval = 200; // 200ms between shots

        // If auto flash is on, turn it on for the burst
        if (this.torchMode === 'auto') {
            await this.setTorchState(true);
        }

        for (let i = 0; i < burstCount; i++) {
            await this.takePhoto();
            if (i < burstCount - 1) {
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        this.showToast(`Captured ${burstCount} photos`);

        // Turn off the flash after burst capture
        if (this.torchMode === 'auto') {
            await this.setTorchState(false);
        }
    }

    async takePhoto() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;

        // Apply current filter to canvas
        if (this.currentFilter !== 'none') {
            ctx.filter = this.getCanvasFilter(this.currentFilter);
        }

        // Mirror the image for front camera
        if (this.currentCamera === 'user') {
            ctx.scale(-1, 1);
            ctx.drawImage(this.video, -canvas.width, 0, canvas.width, canvas.height);
        } else {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }

        canvas.toBlob((blob) => {
            this.downloadFile(blob, `photo_${Date.now()}.webp`, 'image/webp');
        }, 'image/webp', 0.9);

        this.showToast('Photo captured!');
    }

    getCanvasFilter(filter) {
        const filters = {
            sepia: 'sepia(100%)',
            grayscale: 'grayscale(100%)',
            blur: 'blur(2px)',
            brightness: 'brightness(1.3)',
            contrast: 'contrast(1.3)',
            saturate: 'saturate(1.5)',
            'hue-rotate': 'hue-rotate(90deg)',
            invert: 'invert(100%)'
        };
        return filters[filter] || 'none';
    }

    async startRecording() {
        this.recordedChunks = [];

        // For video, if torch mode is 'on', turn it on. Auto mode is ignored.
        if (this.torchMode === 'on') {
            await this.setTorchState(true);
        }

        const options = {
            mimeType: 'video/webm;codecs=vp9,opus'
        };

        try {
            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                this.downloadFile(blob, `video_${Date.now()}.webm`, 'video/webm');
                this.showToast('Video saved!');
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            this.captureBtn.classList.add('recording');
            this.videoControls.style.display = 'flex';
            this.timer.style.display = 'block';
            this.recordingIndicator.style.display = 'block';

            this.startTimer();
            this.showToast('Recording started');

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showToast('Failed to start recording');
        }
    }

    pauseRecording() {
        if (this.isRecording && !this.isPaused) {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pauseBtn.textContent = 'play_arrow';
            this.pauseBtn.title = 'Resume';
            clearInterval(this.timerInterval);
            this.showToast('Recording paused');
        } else if (this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.pauseBtn.textContent = 'pause';
            this.pauseBtn.title = 'Pause';
            this.startTimer();
            this.showToast('Recording resumed');
        }
    }

    stopRecording() {
        if (this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isPaused = false;

            this.captureBtn.classList.remove('recording');
            this.videoControls.style.display = 'none';
            this.timer.style.display = 'none';
            this.recordingIndicator.style.display = 'none';

            this.pauseBtn.textContent = 'pause';
            this.pauseBtn.title = 'Pause';

            clearInterval(this.timerInterval);
        }

        // Ensure torch is off after stopping video recording
        if (this.torchMode === 'on' && !this.isPaused) {
            this.setTorchState(false);
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                const elapsed = Date.now() - this.recordingStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                this.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    async changeResolution(resolution) {
        const [width, height] = resolution.split('x').map(Number);

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: this.currentCamera,
                width: { ideal: width },
                height: { ideal: height }
            },
            audio: true
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.showToast(`Resolution changed to ${resolution}`);
        } catch (error) {
            console.error('Error changing resolution:', error);
            this.showToast('Failed to change resolution');
            await this.startCamera(); // Fallback to default
        }
    }

    downloadFile(blob, filename, mimeType) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showToast(message) {
        this.toast.textContent = message;
        this.toast.style.display = 'block';
        setTimeout(() => {
            this.toast.style.display = 'none';
        }, 2000);
    }
}

// Initialize the camera app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new IKDAOCamera();
});
