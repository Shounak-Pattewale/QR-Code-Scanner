from flask import Flask, render_template

app = Flask(__name__)

@app.get("/")
def home():
    # Redirect to scan test page (simple start)
    return render_template("scan_test.html")

if __name__ == "__main__":
    # Use localhost for camera permissions
    app.run(host="127.0.0.1", port=5000, debug=True)