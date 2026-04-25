/**
 * Barcode Pro - Script Logic
 * Xử lý tạo và quét mã vạch
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const productNameInput = document.getElementById('product-name-input');
    const productNameDisplay = document.getElementById('product-name-display');
    const barcodeInput = document.getElementById('barcode-input');
    const generateBtn = document.getElementById('generate-btn');
    const barcodeCanvas = document.getElementById('barcode-canvas');
    const downloadBtn = document.getElementById('download-btn');
    const placeholderText = document.querySelector('.placeholder-text');
    
    const startScanBtn = document.getElementById('start-scan-btn');
    const stopScanBtn = document.getElementById('stop-scan-btn');
    const scannerOverlay = document.getElementById('scanner-overlay');
    const scanResultCard = document.getElementById('scan-result-card');
    const scanResultValue = document.getElementById('scan-result-value');
    const copyBtn = document.getElementById('copy-btn');
    
    // History elements
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const genHistoryList = document.getElementById('gen-history-list');
    const clearGenHistoryBtn = document.getElementById('clear-gen-history-btn');
    
    // Zoom controls
    const zoomControls = document.getElementById('zoom-controls');
    const zoomSlider = document.getElementById('zoom-slider');
    
    // --- State ---
    let html5QrCode = null;
    let isScanning = false;
    let scanHistory = JSON.parse(localStorage.getItem('barcode_history') || '[]');
    let genHistory = JSON.parse(localStorage.getItem('barcode_gen_history') || '[]');

    // --- Tab Switching Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-section`) {
                    content.classList.add('active');
                }
            });

            // Stop scanner if switching away from scan tab
            if (tabId !== 'scan' && isScanning) {
                stopScanner();
            }
        });
    });

    // --- Barcode Generation Logic ---
    // Hàm dùng chung để tạo mã vạch
    const generateBarcode = (text, productName = '', saveToHistory = true) => {
        if (!text) {
            showToast('Vui lòng nhập dữ liệu để tạo mã vạch');
            return;
        }

        try {
            // Hiển thị tên sản phẩm nếu có
            if (productName.trim()) {
                productNameDisplay.textContent = productName;
                productNameDisplay.classList.remove('hidden');
            } else {
                productNameDisplay.classList.add('hidden');
            }

            // JsBarcode handles the SVG generation
            JsBarcode("#barcode-canvas", text, {
                format: "CODE128",
                lineColor: "#000",
                width: 2,
                height: 100,
                displayValue: true,
                fontSize: 16,
                background: "#ffffff"
            });
            
            placeholderText.classList.add('hidden');
            barcodeCanvas.classList.remove('hidden');
            downloadBtn.classList.remove('hidden');
            
            // Save to generation history if needed
            if (saveToHistory) {
                saveToGenHistory(text, productName);
            }
            
            showToast('Đã tạo mã vạch thành công!');
            return true;
        } catch (error) {
            console.error(error);
            showToast('Lỗi: Dữ liệu không hợp lệ cho định dạng CODE128');
            return false;
        }
    };

    generateBtn.addEventListener('click', () => {
        const text = barcodeInput.value.trim();
        const productName = productNameInput.value.trim();
        generateBarcode(text, productName);
    });

    // --- Download Logic ---
    downloadBtn.addEventListener('click', () => {
        const svg = document.getElementById('barcode-canvas');
        const productName = productNameDisplay.textContent;
        const isProductNameVisible = !productNameDisplay.classList.contains('hidden');
        
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const svgSize = svg.getBBox();
        
        const padding = 14;
        const gap = 14;
        const fontSize = 20;
        const titleHeight = isProductNameVisible ? (fontSize + gap) : 0;
        
        canvas.width = svgSize.width + (padding * 2);
        canvas.height = svgSize.height + (padding * 2) + titleHeight;
        
        const ctx = canvas.getContext("2d");
        const img = new Image();
        
        img.onload = () => {
            // Draw background
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw Title if exists
            if (isProductNameVisible) {
                ctx.fillStyle = "black";
                ctx.font = `bold ${fontSize}px Inter, Arial, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top"; // Căn lề trên để tính toán khoảng cách chính xác hơn
                ctx.fillText(productName, canvas.width / 2, padding);
            }
            
            // Draw Barcode
            ctx.drawImage(img, padding, padding + titleHeight);
            
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            const fileName = productName ? productName.toLowerCase().replace(/\s+/g, '-') : 'barcode';
            downloadLink.download = `${fileName}-${barcodeInput.value}.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
            showToast('Đã tải xuống mã vạch');
        };
        
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });

    // --- Barcode Scanning Logic ---
    let lastResult = null;
    let resultCount = 0;

    const onScanSuccess = (decodedText, decodedResult) => {
        // Cơ chế ổn định (Stabilization): 
        // Tránh trường hợp app quá nhạy dẫn đến đọc sai hoặc đọc thiếu số (ví dụ mã 13 số nhưng chỉ đọc được 6 số).
        // Yêu cầu kết quả phải trùng khớp 2 lần liên tiếp mới chấp nhận.
        
        if (decodedText !== lastResult) {
            lastResult = decodedText;
            resultCount = 1;
            return; // Chưa đủ tin cậy, đợi khung hình tiếp theo
        } else {
            resultCount++;
        }

        // Nếu mã này xuất hiện ổn định (ví dụ 2 lần liên tiếp)
        if (resultCount < 2) {
            return;
        }

        // Reset bộ đệm cho lần quét sau
        lastResult = null;
        resultCount = 0;

        // Success callback
        console.log(`Code matched = ${decodedText}`, decodedResult);
        
        // Stop scanning after success
        stopScanner();
        
        // Show result
        scanResultValue.textContent = decodedText;
        scanResultCard.classList.remove('hidden');
        showToast('Đã tìm thấy mã vạch!');
        
        // Save to history
        saveToHistory(decodedText);
        
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    };

    const startScanner = async () => {
        try {
            // Reset result card
            scanResultCard.classList.add('hidden');
            
            if (!html5QrCode) {
                html5QrCode = new Html5Qrcode("reader");
            }

            const config = { 
                fps: 15, // Tốc độ vừa phải để giải mã chính xác hơn
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    // Trả về vùng quét khớp với tỉ lệ 70% width, 60% height trong CSS
                    return {
                        width: viewfinderWidth * 0.7,
                        height: viewfinderHeight * 0.6
                    };
                },
                aspectRatio: undefined // Để trình duyệt tự chọn tỉ lệ tốt nhất cho camera
            };

            // Khởi chạy camera cơ bản trước
            await html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                onScanSuccess
            );

            isScanning = true;
            startScanBtn.classList.add('hidden');
            stopScanBtn.classList.remove('hidden');
            scannerOverlay.classList.remove('hidden');
            showToast('Đang khởi động camera...');

            // --- Thiết lập các tính năng nâng cao (Zoom/Focus) sau khi camera đã chạy ---
            // Chúng ta dùng setTimeout để đảm bảo track đã ổn định trên mọi thiết bị
            setTimeout(async () => {
                try {
                    const capabilities = html5QrCode.getRunningTrackCapabilities();
                    const settings = html5QrCode.getRunningTrackSettings();
                    const videoElement = document.querySelector('#reader video');
                    
                    if (capabilities && capabilities.zoom) {
                        // --- Hardware Zoom (Mobile) ---
                        zoomControls.classList.remove('hidden');
                        zoomSlider.min = capabilities.zoom.min;
                        zoomSlider.max = capabilities.zoom.max;
                        zoomSlider.step = capabilities.zoom.step || 0.1;
                        zoomSlider.value = settings.zoom || capabilities.zoom.min;
                        
                        zoomSlider.oninput = async () => {
                            try {
                                await html5QrCode.applyVideoConstraints({
                                    advanced: [{ zoom: parseFloat(zoomSlider.value) }]
                                });
                            } catch (e) {
                                console.error("Hardware zoom error:", e);
                            }
                        };
                    } else {
                        // --- Digital Zoom Fallback (PC/Other) ---
                        zoomControls.classList.remove('hidden');
                        zoomSlider.min = 1;
                        zoomSlider.max = 3;
                        zoomSlider.step = 0.1;
                        zoomSlider.value = 1;
                        
                        zoomSlider.oninput = () => {
                            if (videoElement) {
                                videoElement.style.transform = `scale(${zoomSlider.value})`;
                                videoElement.style.transition = "transform 0.2s ease";
                            }
                        };
                    }

                    // Thêm tính năng Tap to Focus sau khi đã chắc chắn có video
                    if (videoElement) {
                        videoElement.onclick = async () => {
                            try {
                                await html5QrCode.applyVideoConstraints({
                                    advanced: [{ focusMode: "continuous" }]
                                });
                                showToast('Đang lấy nét...');
                            } catch (e) {
                                console.log("Tap to focus không được hỗ trợ");
                            }
                        };
                    }
                } catch (e) {
                    console.warn("Không thể thiết lập tính năng nâng cao:", e);
                }
            }, 500);

        } catch (err) {
            console.error("Lỗi khởi động camera:", err);
            
            let errorMsg = 'Không thể truy cập camera.';
            if (err.name === 'NotAllowedError' || err === 'NotAllowedError') {
                errorMsg = 'Bạn đã từ chối cấp quyền camera. Vui lòng bật lại trong cài đặt trình duyệt.';
            } else if (err.name === 'NotFoundError' || err === 'NotFoundError') {
                errorMsg = 'Không tìm thấy camera trên thiết bị này.';
            } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                errorMsg = 'Camera yêu cầu kết nối bảo mật (HTTPS).';
            }
            
            showToast(errorMsg);
            
            // Reset UI
            isScanning = false;
            startScanBtn.classList.remove('hidden');
            stopScanBtn.classList.add('hidden');
            scannerOverlay.classList.add('hidden');
        }
    };

    const stopScanner = async () => {
        if (html5QrCode && isScanning) {
            try {
                await html5QrCode.stop();
                isScanning = false;
                startScanBtn.classList.remove('hidden');
                stopScanBtn.classList.add('hidden');
                scannerOverlay.classList.add('hidden');
                zoomControls.classList.add('hidden');
            } catch (err) {
                console.error("Lỗi dừng camera:", err);
            }
        }
    };

    startScanBtn.addEventListener('click', startScanner);
    stopScanBtn.addEventListener('click', stopScanner);

    // --- Copy to Clipboard ---
    copyBtn.addEventListener('click', () => {
        const text = scanResultValue.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Đã sao chép vào bộ nhớ tạm');
        });
    });

    // --- History Helper Functions ---
    function saveToHistory(code) {
        const timestamp = new Date().toLocaleString('vi-VN');
        const newItem = { code, time: timestamp, id: Date.now() };
        
        // Add to beginning of array
        scanHistory.unshift(newItem);
        
        // Keep only last 50 items
        if (scanHistory.length > 50) {
            scanHistory.pop();
        }
        
        localStorage.setItem('barcode_history', JSON.stringify(scanHistory));
        renderHistory();
    }

    function renderHistory() {
        if (scanHistory.length === 0) {
            historyList.innerHTML = '<p class="placeholder-text">Chưa có lịch sử quét nào</p>';
            return;
        }

        historyList.innerHTML = '';
        scanHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-info">
                    <span class="history-code">${item.code}</span>
                    <span class="history-time">${item.time}</span>
                </div>
                <div class="history-actions">
                    <button class="btn-icon copy-history" data-code="${item.code}" title="Sao chép">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-icon delete-history" data-id="${item.id}" title="Xóa">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            historyList.appendChild(div);
        });

        // Add event listeners for history actions
        document.querySelectorAll('.copy-history').forEach(btn => {
            btn.onclick = () => {
                navigator.clipboard.writeText(btn.getAttribute('data-code'));
                showToast('Đã sao chép mã vạch');
            };
        });

        document.querySelectorAll('.delete-history').forEach(btn => {
            btn.onclick = () => {
                const id = parseInt(btn.getAttribute('data-id'));
                scanHistory = scanHistory.filter(item => item.id !== id);
                localStorage.setItem('barcode_history', JSON.stringify(scanHistory));
                renderHistory();
                showToast('Đã xóa mục lịch sử');
            };
        });
    }

    clearHistoryBtn.onclick = () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử quét không?')) {
            scanHistory = [];
            localStorage.setItem('barcode_history', JSON.stringify(scanHistory));
            renderHistory();
            showToast('Đã xóa toàn bộ lịch sử');
        }
    };

    // --- Generation History Helper Functions ---
    function saveToGenHistory(code, productName = '') {
        const timestamp = new Date().toLocaleString('vi-VN');
        const newItem = { code, productName, time: timestamp, id: Date.now() };

        // Tránh trùng lặp: nếu mã đã tồn tại (dựa trên giá trị code), xóa mã cũ
        genHistory = genHistory.filter(item => item.code !== code);
        genHistory.unshift(newItem);
        
        // Giới hạn 20 mục gần đây cho danh sách dọc
        if (genHistory.length > 20) {
            genHistory.pop();
        }
        
        localStorage.setItem('barcode_gen_history', JSON.stringify(genHistory));
        renderGenHistory();
    }

    function renderGenHistory() {
        if (genHistory.length === 0) {
            genHistoryList.innerHTML = '<p class="placeholder-text" style="font-size: 0.8rem">Chưa có mã nào được tạo</p>';
            return;
        }

        genHistoryList.innerHTML = '';
        genHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'gen-item';
            div.innerHTML = `
                <div class="history-info">
                    <span class="history-code">${item.productName ? item.productName + ' - ' : ''}${item.code}</span>
                    <span class="history-time">${item.time}</span>
                </div>
                <div class="history-actions">
                    <button class="btn-icon copy-gen" data-code="${item.code}" title="Sao chép">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-icon delete-gen" data-id="${item.id}" title="Xóa">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            
            // Khi click vào vùng thông tin thì tạo lại mã
            div.querySelector('.history-info').onclick = (e) => {
                e.stopPropagation();
                barcodeInput.value = item.code;
                productNameInput.value = item.productName || '';
                generateBarcode(item.code, item.productName || '', true); // Gọi trực tiếp hàm tạo mã
                showToast(`Đã chọn mã: ${item.code}`);
                // Cuộn lên đầu trang để xem mã vừa tạo
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            genHistoryList.appendChild(div);
        });

        // Add event listeners for gen history actions
        document.querySelectorAll('.copy-gen').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(btn.getAttribute('data-code'));
                showToast('Đã sao chép mã vạch');
            };
        });

        document.querySelectorAll('.delete-gen').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                genHistory = genHistory.filter(item => item.id !== id);
                localStorage.setItem('barcode_gen_history', JSON.stringify(genHistory));
                renderGenHistory();
                showToast('Đã xóa mục lịch sử');
            };
        });
    }

    clearGenHistoryBtn.onclick = () => {
        genHistory = [];
        localStorage.setItem('barcode_gen_history', JSON.stringify(genHistory));
        renderGenHistory();
        showToast('Đã xóa lịch sử tạo');
    };

    // --- Helper: Toast Notification ---
    function showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Remove from DOM after animation completes
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // --- Khởi tạo dữ liệu ban đầu ---
    // Gọi sau một khoảng trễ ngắn để đảm bảo thư viện JsBarcode và DOM đã hoàn toàn sẵn sàng
    const initApp = () => {
        if (typeof JsBarcode === 'function') {
            console.log("JsBarcode đã sẵn sàng.");
            renderHistory();
            renderGenHistory();
        } else {
            console.warn("Đang đợi JsBarcode tải...");
            // Thử lại sau 500ms nếu thư viện chưa tải xong
            setTimeout(initApp, 500);
        }
    };

    // Bắt đầu quá trình khởi tạo sau khi DOM sẵn sàng 300ms để tạo cảm giác mượt mà
    setTimeout(initApp, 300);
});
