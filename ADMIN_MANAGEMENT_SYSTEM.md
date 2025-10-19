# CompareAI Admin Management System

A comprehensive user management system built with 2025 best practices, featuring role-based access control, audit logging, and secure admin operations.

## 🚀 Features

### **Role-Based Access Control (RBAC)**

- **User**: Regular users with subscription-based limits
- **Moderator**: Basic admin access for user management
- **Admin**: Full admin access including user CRUD operations
- **Super Admin**: Complete access including user deletion

### **User Management Operations**

- ✅ Create new users with custom roles and subscriptions
- ✅ Update user details (email, role, subscription, status)
- ✅ Toggle user active/inactive status
- ✅ Reset user passwords
- ✅ Send verification emails
- ✅ Delete users (super admin only)

### **Audit & Security**

- 🔍 Complete audit trail of all admin actions
- 🔒 IP address and user agent logging
- 🛡️ Zero-trust architecture with strict verification
- 📊 Admin action logs with detailed change tracking

### **Dashboard & Analytics**

- 📈 Real-time system statistics
- 👥 User breakdown by role and subscription tier
- 📅 Recent registration tracking
- 💾 Usage analytics and overage monitoring

## 🛠️ Installation & Setup

### 1. **Database Migration**

Run the migration script to add admin features to your existing database:

```bash
cd backend
python migrate_admin.py
```

This will:

- Add admin role fields to the User model
- Create the AdminActionLog table for audit trails
- Update existing users with default values

### 2. **Create First Admin User**

After migration, create your first admin user:

```bash
cd backend
python create_admin_user.py
```

Follow the interactive prompts to set up your super admin account.

### 3. **Restart Application**

Restart your CompareAI application to load the new admin features:

```bash
# If using Docker
docker-compose restart backend

# If running locally
python -m uvicorn app.main:app --reload
```

## 📚 API Endpoints

### **Admin Statistics**

```http
GET /admin/stats
```

Returns system statistics including user counts, subscription breakdowns, and usage metrics.

### **User Management**

```http
GET /admin/users?page=1&per_page=20&search=email&role=admin&tier=pro
POST /admin/users
GET /admin/users/{user_id}
PUT /admin/users/{user_id}
DELETE /admin/users/{user_id}
```

### **User Actions**

```http
POST /admin/users/{user_id}/toggle-active
POST /admin/users/{user_id}/reset-password
POST /admin/users/{user_id}/send-verification
```

### **Audit Logs**

```http
GET /admin/action-logs?page=1&per_page=50&action_type=user_create
```

## 🔐 Security Features

### **Authentication Requirements**

- All admin endpoints require valid JWT authentication
- Admin role verification on every request
- Role hierarchy enforcement (moderator < admin < super_admin)

### **Audit Logging**

Every admin action is logged with:

- Admin user who performed the action
- Target user (if applicable)
- Action type and description
- Detailed change information
- IP address and user agent
- Timestamp

### **Data Protection**

- Password strength validation (12+ chars, mixed case, numbers, symbols)
- Email uniqueness enforcement
- Self-modification protection (can't change own role/status)
- Super admin protection (can't delete other super admins)

## 🎨 Frontend Integration

### **Admin Panel Component**

Import and use the AdminPanel component in your React application:

```tsx
import { AdminPanel } from "./components/admin";

function App() {
  return (
    <div>
      {/* Your existing app content */}
      <AdminPanel />
    </div>
  );
}
```

### **Admin Panel Features**

- 📊 Real-time dashboard with system statistics
- 🔍 Advanced user search and filtering
- 📋 Paginated user management table
- ⚡ Quick actions (activate/deactivate, send verification)
- 📱 Responsive design for mobile and desktop

## 🔧 Configuration

### **Environment Variables**

No additional environment variables required. The admin system uses your existing:

- `DATABASE_URL` for database connection
- `SECRET_KEY` for JWT token validation

### **Role Permissions**

| Role        | User Management | User Deletion | Password Reset | Verification |
| ----------- | --------------- | ------------- | -------------- | ------------ |
| Moderator   | ✅ View, Update | ❌            | ❌             | ✅           |
| Admin       | ✅ Full CRUD    | ❌            | ✅             | ✅           |
| Super Admin | ✅ Full CRUD    | ✅            | ✅             | ✅           |

## 📊 Database Schema

### **User Model Updates**

```sql
-- New admin fields added to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN admin_permissions TEXT;
```

### **AdminActionLog Table**

```sql
CREATE TABLE admin_action_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL,
    target_user_id INTEGER,
    action_type VARCHAR(100) NOT NULL,
    action_description TEXT NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users (id),
    FOREIGN KEY (target_user_id) REFERENCES users (id)
);
```

## 🚨 Best Practices (2025)

### **Security**

- ✅ Zero Trust Architecture - verify every admin action
- ✅ Role-based access control with hierarchy
- ✅ Complete audit trail for compliance
- ✅ IP and user agent logging for security
- ✅ Self-modification protection

### **User Experience**

- ✅ Responsive admin panel design
- ✅ Real-time statistics and analytics
- ✅ Advanced search and filtering
- ✅ Bulk operations support
- ✅ Clear error messages and feedback

### **Data Privacy**

- ✅ GDPR/CCPA compliance ready
- ✅ Detailed audit logs for data access
- ✅ User consent tracking
- ✅ Data retention policies

## 🔍 Monitoring & Maintenance

### **Audit Log Review**

Regularly review admin action logs to ensure:

- No unauthorized access attempts
- Proper use of admin privileges
- Compliance with data protection regulations

### **User Management**

- Monitor user registration patterns
- Track subscription tier distributions
- Review inactive user accounts
- Monitor overage usage patterns

### **Security Monitoring**

- Watch for unusual admin activity patterns
- Monitor failed authentication attempts
- Review IP address patterns in audit logs
- Track role escalation attempts

## 🆘 Troubleshooting

### **Common Issues**

**"Admin access required" error**

- Ensure user has `is_admin = true` in database
- Check user role is set to moderator/admin/super_admin
- Verify JWT token is valid and not expired

**"Cannot modify your own role" error**

- This is a security feature preventing self-demotion
- Use another admin account to modify roles
- Or temporarily promote another user to admin

**Migration errors**

- Ensure database is not locked by running application
- Check database permissions for ALTER TABLE operations
- Verify DATABASE_URL environment variable is correct

### **Support**

For issues with the admin system:

1. Check the audit logs for error details
2. Review application logs for backend errors
3. Verify database schema matches expected structure
4. Test with a fresh admin user account

## 🎯 Future Enhancements

### **Planned Features**

- 📧 Email notifications for admin actions
- 🔔 Real-time admin dashboard updates
- 📊 Advanced analytics and reporting
- 🔐 Two-factor authentication for admin accounts
- 📱 Mobile admin app
- 🤖 Automated user management workflows

### **Integration Opportunities**

- Slack/Teams notifications for admin actions
- External audit log export
- User import/export functionality
- Advanced role customization
- API rate limiting for admin endpoints

---
