from flask import Flask, render_template

app = Flask(__name__)

@app.get("/")
def home():
    # Redirect to scan test page (simple start)
    return render_template("scan_mobile.html")

if __name__ == "__main__":
    # Use localhost for camera permissions
    app.run(host="0.0.0.0", port=5000, debug=True)