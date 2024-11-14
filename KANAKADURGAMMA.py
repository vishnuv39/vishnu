import os
from flask import Flask, request, jsonify, render_template
import google.generativeai as genai
from flask_caching import Cache

# Initialize Flask app and cache
app = Flask(__name__)
cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache'})

# Configure the Gemini API key
genai.configure(api_key= "AIzaSyAkOEUSEKepUiphihNOwDHpE9epgtv2ytg")

# Function to fetch the complete solution from ChatGPT with refined prompt
def get_complete_solution(question):
    prompt = f"""
    Task: Provide a complete detailed, step-by-step solution to the question below, ensuring that every mathematical expression is written in LaTeX format. Do not label as step 1 or 1. Also do not give numbering for steps. Strictly adhere to the following guidelines. Do not use Step by Step explanation line or sentence in anywhere of the solution.

    Formatting Requirements:
    1. **Step-by-Step Explanation**: Begin each step with a concise explanation, followed by any necessary mathematical expressions. Most importantly, give the complete solution.
    2. **LaTeX for All Math**: Every mathematical expression should be enclosed in LaTeX notation, with `$...$` for inline math and `$$...$$` for centered display math.
    3. **Consistent Use of Symbols**: Use `\\` for required LaTeX operations (e.g., `\\cdot` for multiplication).
    4. **Strict Output Structure**: Ensure each answer is relevant, accurate, and maintains this structure.

    Question: {question}
    """

    try:
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")
        response = model.generate_content(prompt)
        content = response.text.strip()
        # Format the solution for display
        formatted_solution = format_solution(content)
        return formatted_solution
    except Exception as e:
        return f"Error with Gemini AI API: {e}"


# Function to format solution by separating explanations and math expressions
def format_solution(solution):
    steps = solution.split('\n')
    formatted_steps = [step.strip() for step in steps if step.strip()]  # Remove any empty steps
    return formatted_steps

# Function to generate minimal and concise hints from ChatGPT
def get_hint(question, current_step, hint_level, previous_hint=None):
    # Refine the prompt based on the hint level
    if hint_level == 1:
        prompt = f"""
        Task: Explain the purpose of the current step in the context of the solution, ensuring all mathematical expressions are in LaTeX format.

        Formatting Requirements:
        - Use `$...$` for inline math.
        - Use `$$...$$` for display math.

        Example:
        - Inline math: `$f'(x) = n \\cdot x^{{n-1}}$`
        - Display math: `$$\\int_a^b f(x) \\, dx$$`

        Question: {question}
        Current Step: {current_step}
        """
    elif hint_level == 2:
        prompt = f"""
        Task: Provide a concise breakdown of the key action in this step, using LaTeX for all mathematical expressions.

        Formatting Requirements:
        - Use `$...$` for inline math.
        - Use `$$...$$` for display math.

        Example:
        - Inline math: `$3x^{{2}}$`
        - Display math: `$$\\frac{{d}}{{dx}}(x^{{2}})$$`

        Question: {question}
        Current Step: {current_step}
        """
    else:
        prompt = f"""
        Task: Give a simplified breakdown of the previous hint, retaining only the core actions necessary, with all math in LaTeX format.

        Formatting Requirements:
        - Use `$...$` for inline math.
        - Use `$$...$$` for display math.

        Example:
        - Inline math: `$e^{{x^{{2}}}}$`
        - Display math: `$$\\sum_{{i=1}}^{{n}} i$$`

        Question: {question}
        Current Step: {current_step}
        Previous Hint: {previous_hint if previous_hint else ""}
        """

    try:
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")
        response = model.generate_content(prompt)
        content = response.text.strip()
        return content
    except Exception as e:
        return f"Error with Gemini AI API: {e}"

# Route to handle solution generation
@app.route('/solve', methods=['POST'])
def solve():
    data = request.json
    question = data.get('question')

    if not question:
        return jsonify({"error": "No question provided"}), 400

    # Generate the complete solution using ChatGPT
    solution = get_complete_solution(question)

    # Cache the results for later use if necessary
    cache.set(f"solution_{question}", solution)
    cache.set(f"main_steps_{question}", solution)

    # Return the solution and steps
    return jsonify({"solution": '\n\n'.join(solution), "main_steps": solution})

# Route to handle direct solution generation for camera input
@app.route('/solve_direct', methods=['POST'])
def solve_direct():
    data = request.json
    question = data.get('question')

    if not question:
        return jsonify({"error": "No question provided"}), 400

    # Generate the complete solution directly for the camera input
    solution = get_complete_solution(question)

    # Cache the results for later use if necessary
    cache.set(f"solution_{question}", solution)
    cache.set(f"main_steps_{question}", solution)

    # Return the solution without displaying the question in the input box
    return jsonify({"solution": '\n\n'.join(solution), "main_steps": solution})

# Route to handle hint generation
@app.route('/hint', methods=['POST'])
def hint():
    data = request.get_json()
    question = data.get('question')
    current_step = data.get('current_step')
    hint_level = data.get('hint_level', 1)
    previous_hint = data.get('previous_hint', None)

    if not question or not current_step:
        return jsonify({"error": "Missing question or step"}), 400

    # Generate the hint using ChatGPT
    hint = get_hint(question, current_step, hint_level, previous_hint)

    # Return the generated hint
    return jsonify({"hint": hint})

# Home route to render the main page
@app.route('/')
def home():
    return render_template('index.html')

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)

