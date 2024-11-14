let currentStepIndex = 0;
let mainSteps = [];
let hintLevel = 1;
let recognition;
let returnClickCount = 0; // Counter for the number of returns to home

// Mathpix API credentials (make sure to replace with your actual API credentials)
const MATHPIX_API_ID = 'eduvance_cf2704_f97c8e';
const MATHPIX_API_KEY = '8af179642e742a903e2d02c245ce782778d7893f0d12e0099369a776d37fb81d';

// AI Disclaimer message handling
function showDisclaimer() {
    document.getElementById("disclaimerContent").style.display = "block";
    document.getElementById("homePage").style.display = "none";
    document.getElementById("homeLinks").style.display = "none";
}

// Close the disclaimer message and return to the home page
function closeDisclaimer() {
    document.getElementById("disclaimerContent").style.display = "none";
    document.getElementById("homePage").style.display = "flex";
    document.getElementById("homeLinks").style.display = "flex";
}

// Show Google Form prompt after two "Return" clicks
function showGoogleFormPrompt() {
    if (!localStorage.getItem("formSubmitted") && returnClickCount >= 2) {
        document.getElementById("googleFormContainer").style.display = "block";
    }
}

// Function to hide the Google Form prompt
function hideFormPrompt() {
    document.getElementById("googleFormContainer").style.display = "none";
    localStorage.setItem("formSubmitted", "true");
}

// Check if the browser supports the SpeechRecognition API
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById("questionInput").value = transcript;
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
    };
} else {
    alert("Speech recognition is not supported in this browser.");
}

// Function to start voice recognition
function startVoiceInput() {
    if (recognition) {
        recognition.start();
    } else {
        console.error("Speech recognition is not supported.");
    }
}

// Function to handle photo upload and send it to Mathpix OCR
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = function() {
            const base64Image = reader.result.split(',')[1];
            processMathpixOCR(base64Image);
        };
        reader.readAsDataURL(file);
    }
}

// Function to send the image to Mathpix API and process the response
function processMathpixOCR(base64Image) {
    axios.post('https://api.mathpix.com/v3/text', {
        src: `data:image/png;base64,${base64Image}`
    }, {
        headers: {
            'Content-Type': 'application/json',
            'app_id': MATHPIX_API_ID,
            'app_key': MATHPIX_API_KEY
        }
    })
    .then(response => {
        const extractedText = response.data.text;
        submitCameraQuestion(extractedText);
    })
    .catch(error => {
        console.error("Mathpix OCR Error:", error);
    });
}

// Submit question directly from camera input and display solution
function submitCameraQuestion(cameraQuestion) {
    if (cameraQuestion) {
        fetch('/solve_direct', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: cameraQuestion }),
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById("homePage").style.display = "none";
            document.getElementById("solutionPage").style.display = "block";
            document.getElementById("homeLinks").style.display = "none"; // Hide links on solution page
            document.getElementById("solutionContent").innerHTML = renderSolutionSteps(data.main_steps);
            mainSteps = data.main_steps;
            hintLevel = 1;
            document.getElementById("hintsContent").innerHTML = ""; // Clear previous hints

            if (window.MathJax) {
                MathJax.typesetPromise();
            }
        })
        .catch(error => console.error('Error:', error));
    } else {
        alert("No question extracted from the image.");
    }
}

// Submit question and display solution (for text and mic input)
function submitQuestion() {
    const question = document.getElementById("questionInput").value;

    if (question) {
        fetch('/solve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: question }),
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById("homePage").style.display = "none";
            document.getElementById("solutionPage").style.display = "block";
            document.getElementById("homeLinks").style.display = "none"; // Hide links on solution page
            document.getElementById("solutionContent").innerHTML = renderSolutionSteps(data.main_steps);
            mainSteps = data.main_steps;
            hintLevel = 1;
            document.getElementById("hintsContent").innerHTML = ""; // Clear previous hints

            if (window.MathJax) {
                MathJax.typesetPromise();
            }
        })
        .catch(error => console.error('Error:', error));
    } else {
        alert("Please enter a question.");
    }
}

// Search function to handle the search icon click
function searchFunction() {
    const question = document.getElementById("questionInput").value;
    if (question) {
        submitQuestion();
    } else {
        alert("Please enter a question to search.");
    }
}

// Render solution steps as clickable items
function renderSolutionSteps(steps) {
    return steps.map((step, index) =>
        `<div class="step" onclick="resetHintsForNewStep(${index})">${step}</div>`
    ).join('<br>'); // Add a line break between steps for better readability
}

// Fetch and display hint for the clicked step
function getHint(stepIndex) {
    const currentStep = mainSteps[stepIndex];
    currentStepIndex = stepIndex;

    fetch('/hint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question: mainSteps.join('\n'), // Send the entire solution as context
            current_step: currentStep,
            hint_level: hintLevel
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (hintLevel === 1) {
            document.getElementById("hintsContent").innerHTML = `<strong>Hints for Step ${stepIndex + 1}</strong><br>`;
        }
        document.getElementById("hintsContent").innerHTML += `<div class="hint-level">Level ${hintLevel}: ${data.hint}</div><br>`;
        hintLevel++; // Increase hint level

        if (window.MathJax) {
            MathJax.typesetPromise();
        }
    })
    .catch(error => console.error('Error:', error));
}

// Function to display Manual or About Us content
function showContent(contentType) {
    document.getElementById("homePage").style.display = "none";
    document.getElementById("solutionPage").style.display = "none";
    document.getElementById("manualContent").style.display = contentType === 'manual' ? 'block' : 'none';
    document.getElementById("aboutContent").style.display = contentType === 'about' ? 'block' : 'none';
}

// Return to the home page (for the return icon)
function returnToHome() {
    document.getElementById('solutionPage').style.display = 'none';
    document.getElementById("manualContent").style.display = 'none';
    document.getElementById("aboutContent").style.display = 'none';
    document.getElementById('homePage').style.display = 'flex';
    document.getElementById("homeLinks").style.display = "flex"; // Show links only on the home page
    document.getElementById("solutionContent").innerHTML = "";
    document.getElementById("hintsContent").innerHTML = "";
    hintLevel = 1;

    returnClickCount++;  // Increment the return click count
    showGoogleFormPrompt();
}

// Close content box and return to home page
function closeContentBox() {
    document.getElementById("manualContent").style.display = "none";
    document.getElementById("aboutContent").style.display = "none";
    document.getElementById("disclaimerContent").style.display = "none";
    document.getElementById("homePage").style.display = "flex";
    document.getElementById("homeLinks").style.display = "flex"; // Show Manual and About Us links
}

// When a new step is clicked, reset the hint level and clear previous hints
function resetHintsForNewStep(stepIndex) {
    if (currentStepIndex !== stepIndex || hintLevel === 1) {
        currentStepIndex = stepIndex;
        hintLevel = 1;
        document.getElementById("hintsContent").innerHTML = "";
    }
    getHint(stepIndex);
}

// Show the disclaimer message on page load
window.onload = function() {
    showDisclaimer();
};

