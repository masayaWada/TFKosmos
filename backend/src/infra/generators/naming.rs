pub struct NamingGenerator;

impl NamingGenerator {
    pub fn to_snake_case(s: &str) -> String {
        s.replace('-', "_").replace('.', "_").to_lowercase()
    }

    pub fn to_kebab_case(s: &str) -> String {
        s.replace('_', "-").replace('.', "-").to_lowercase()
    }

    pub fn apply_naming_convention(s: &str, convention: &str) -> String {
        match convention {
            "snake_case" => Self::to_snake_case(s),
            "kebab-case" => Self::to_kebab_case(s),
            "original" => s.to_string(),
            _ => s.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_snake_case_with_hyphen() {
        assert_eq!(NamingGenerator::to_snake_case("my-resource-name"), "my_resource_name");
    }

    #[test]
    fn test_to_snake_case_with_dot() {
        assert_eq!(NamingGenerator::to_snake_case("my.resource.name"), "my_resource_name");
    }

    #[test]
    fn test_to_snake_case_with_uppercase() {
        assert_eq!(NamingGenerator::to_snake_case("MyResourceName"), "myresourcename");
    }

    #[test]
    fn test_to_snake_case_mixed() {
        assert_eq!(NamingGenerator::to_snake_case("My-Resource.Name"), "my_resource_name");
    }

    #[test]
    fn test_to_kebab_case_with_underscore() {
        assert_eq!(NamingGenerator::to_kebab_case("my_resource_name"), "my-resource-name");
    }

    #[test]
    fn test_to_kebab_case_with_dot() {
        assert_eq!(NamingGenerator::to_kebab_case("my.resource.name"), "my-resource-name");
    }

    #[test]
    fn test_to_kebab_case_with_uppercase() {
        assert_eq!(NamingGenerator::to_kebab_case("MyResourceName"), "myresourcename");
    }

    #[test]
    fn test_to_kebab_case_mixed() {
        assert_eq!(NamingGenerator::to_kebab_case("My_Resource.Name"), "my-resource-name");
    }

    #[test]
    fn test_apply_naming_convention_snake_case() {
        assert_eq!(NamingGenerator::apply_naming_convention("my-name", "snake_case"), "my_name");
    }

    #[test]
    fn test_apply_naming_convention_kebab_case() {
        assert_eq!(NamingGenerator::apply_naming_convention("my_name", "kebab-case"), "my-name");
    }

    #[test]
    fn test_apply_naming_convention_original() {
        assert_eq!(NamingGenerator::apply_naming_convention("My-Name_Test", "original"), "My-Name_Test");
    }

    #[test]
    fn test_apply_naming_convention_unknown_returns_original() {
        assert_eq!(NamingGenerator::apply_naming_convention("My-Name", "unknown"), "My-Name");
    }
}
