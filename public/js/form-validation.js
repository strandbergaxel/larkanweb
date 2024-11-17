class FormValidator {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.form.querySelectorAll('.input-field').forEach(input => {
            input.addEventListener('input', () => this.validateField(input));
            input.addEventListener('blur', () => this.validateField(input));
        });
    }

    validateField(input) {
        const validationMessage = input.parentElement.querySelector('.validation-message');
        
        // Reset states
        input.classList.remove('is-valid', 'is-invalid');
        validationMessage.textContent = '';
        
        if (!input.value && input.required) {
            this.setInvalid(input, 'Detta fält är obligatoriskt');
            return false;
        }

        if (input.type === 'email' && input.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value)) {
                this.setInvalid(input, 'Ange en giltig e-postadress');
                return false;
            }
        }

        if (input.pattern && input.value) {
            const regex = new RegExp(input.pattern);
            if (!regex.test(input.value)) {
                const messages = {
                    name: 'Ange ett giltigt namn',
                    phone: 'Ange ett giltigt telefonnummer'
                };
                this.setInvalid(input, messages[input.id] || 'Ogiltigt format');
                return false;
            }
        }

        this.setValid(input);
        return true;
    }

    setInvalid(input, message) {
        input.classList.add('is-invalid');
        const validationMessage = input.parentElement.querySelector('.validation-message');
        validationMessage.textContent = message;
        validationMessage.classList.add('error');
    }

    setValid(input) {
        input.classList.add('is-valid');
        const validationMessage = input.parentElement.querySelector('.validation-message');
        validationMessage.classList.add('success');
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        let isValid = true;
        this.form.querySelectorAll('.input-field').forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        if (!isValid) return;

        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.classList.add('loading');

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            this.showSuccess();
        } catch (error) {
            this.showError();
        } finally {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
        }
    }

    showSuccess() {
        // Add success notification logic
    }

    showError() {
        // Add error notification logic
    }
}

// Initialize form validation
new FormValidator('joinForm'); 